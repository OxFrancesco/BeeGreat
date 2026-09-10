package com.beegreat.app.voice

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import com.beegreat.flue.FlueJson
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

enum class RealtimeStatus {
  Disconnected,
  Connecting,
  Listening,
  Thinking,
  Speaking,
  Error,
}

data class RealtimeTurn(val id: String, val role: String, val text: String)

data class RealtimeState(
  val status: RealtimeStatus = RealtimeStatus.Disconnected,
  val turns: List<RealtimeTurn> = emptyList(),
  val errorMessage: String? = null,
) {
  val isActive: Boolean
    get() = status != RealtimeStatus.Disconnected && status != RealtimeStatus.Error

  val orbState: OrbState
    get() =
      when (status) {
        RealtimeStatus.Listening -> OrbState.Listening
        RealtimeStatus.Connecting, RealtimeStatus.Thinking -> OrbState.Thinking
        RealtimeStatus.Speaking -> OrbState.Speaking
        else -> OrbState.Idle
      }
}

private const val SAMPLE_RATE = 24_000
private const val CONNECT_TIMEOUT_MS = 15_000L

private const val SESSION_INSTRUCTIONS =
  """You are Bee, BeeGreat's warm conversational companion.
You are speaking live, so respond naturally and concisely. Keep most turns to a few sentences.
Ask one useful follow-up when it helps. Never read machine identifiers aloud.
You do not have access to the user's BeeGreat goals, tasks, Mind, or account tools in this live mode.
If the user asks you to change or retrieve BeeGreat data, explain briefly that they should use a voice note or typed chat."""

/**
 * Live speech-to-speech with Grok Voice over the worker-minted token. Port of
 * `useXaiVoiceConversation`: mic PCM16 at 24 kHz streams up as
 * `input_audio_buffer.append`, the model's PCM deltas play through an
 * AudioTrack, transcripts fill the turn timeline, and server VAD drives the
 * listening/thinking/speaking status.
 */
class RealtimeConversation(private val api: VoiceApi, private val http: OkHttpClient, private val scope: CoroutineScope) {
  private val _state = MutableStateFlow(RealtimeState())
  val state: StateFlow<RealtimeState> = _state.asStateFlow()

  private var socket: WebSocket? = null
  private var generation = 0
  private var micJob: Job? = null
  private var connectTimeout: Job? = null
  private var track: AudioTrack? = null
  private var responseId: String? = null
  private var responseHasAudio = false
  private val muted = AtomicBoolean(false)

  fun start() {
    if (_state.value.isActive) return
    val session = ++generation
    _state.value = RealtimeState(status = RealtimeStatus.Connecting)
    scope.launch {
      try {
        val token = api.realtimeToken()
        if (session != generation) return@launch
        val request = Request.Builder().url(token.websocketUrl).header("Sec-WebSocket-Protocol", "bee-voice.${token.token}").build()
        connectTimeout = launch {
          delay(CONNECT_TIMEOUT_MS)
          if (session == generation && _state.value.status == RealtimeStatus.Connecting) fail("Bee could not connect to conversational voice.")
        }
        socket = http.newWebSocket(request, Listener(session))
      } catch (e: Exception) {
        if (session == generation) fail(e.message ?: "Conversational voice could not start.")
      }
    }
  }

  fun stop() {
    generation++
    connectTimeout?.cancel()
    micJob?.cancel()
    micJob = null
    socket?.close(1000, "Conversation ended")
    socket = null
    releaseTrack()
    _state.update { it.copy(status = RealtimeStatus.Disconnected) }
  }

  private fun fail(message: String) {
    stop()
    _state.update { it.copy(status = RealtimeStatus.Error, errorMessage = message) }
  }

  private inner class Listener(private val session: Int) : WebSocketListener() {
    private fun current() = session == generation

    override fun onOpen(webSocket: WebSocket, response: Response) {
      if (!current()) {
        webSocket.close(1000, "Conversation ended")
        return
      }
      webSocket.send(
        buildJsonObject {
          put("type", "session.update")
          put(
            "session",
            buildJsonObject {
              put("instructions", SESSION_INSTRUCTIONS)
              put("voice", "eve")
              put("reasoning", buildJsonObject { put("effort", "high") })
              put("turn_detection", buildJsonObject { put("type", "server_vad"); put("silence_duration_ms", 650); put("prefix_padding_ms", 333) })
              put(
                "audio",
                buildJsonObject {
                  put("input", buildJsonObject { put("format", buildJsonObject { put("type", "audio/pcm"); put("rate", SAMPLE_RATE) }); put("transcription", buildJsonObject { put("model", "grok-transcribe") }) })
                  put("output", buildJsonObject { put("format", buildJsonObject { put("type", "audio/pcm"); put("rate", SAMPLE_RATE) }) })
                },
              )
            },
          )
        }.toString()
      )
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      if (!current()) return
      val event = runCatching { FlueJson.parseToJsonElement(text).jsonObject }.getOrNull() ?: return
      handle(event, webSocket)
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      if (!current()) return
      Log.w(TAG, "voice.xai.socket", t)
      fail("Bee could not connect to conversational voice.")
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      if (!current()) return
      if (_state.value.isActive) fail("The live voice session ended ($code).")
    }
  }

  private fun handle(event: JsonObject, webSocket: WebSocket) {
    val type = event["type"]?.jsonPrimitive?.contentOrNull ?: return
    when (type) {
      "session.updated" -> {
        connectTimeout?.cancel()
        _state.update { it.copy(status = RealtimeStatus.Listening, errorMessage = null) }
        startMicrophone(webSocket)
      }
      "input_audio_buffer.speech_started" -> {
        // The user interrupted: drop whatever Bee was saying.
        releaseTrack()
        _state.update { it.copy(status = RealtimeStatus.Listening) }
      }
      "input_audio_buffer.speech_stopped" -> _state.update { it.copy(status = RealtimeStatus.Thinking) }
      "conversation.item.input_audio_transcription.updated", "conversation.item.input_audio_transcription.completed" -> {
        val transcript = event["transcript"]?.jsonPrimitive?.contentOrNull ?: return
        upsertTurn(event["item_id"]?.jsonPrimitive?.contentOrNull ?: "user-${System.currentTimeMillis()}", "user", transcript, append = false)
      }
      "response.created" -> {
        responseId = (event["response"] as? JsonObject)?.get("id")?.jsonPrimitive?.contentOrNull ?: "assistant-${System.currentTimeMillis()}"
        responseHasAudio = false
        _state.update { it.copy(status = RealtimeStatus.Thinking) }
      }
      "response.output_audio_transcript.delta", "response.audio_transcript.delta" -> {
        val delta = event["delta"]?.jsonPrimitive?.contentOrNull ?: return
        val id = event["response_id"]?.jsonPrimitive?.contentOrNull ?: responseId ?: return
        upsertTurn(id, "assistant", delta, append = true)
      }
      "response.output_audio.delta", "response.audio.delta" -> {
        val delta = event["delta"]?.jsonPrimitive?.contentOrNull ?: return
        val pcm = Base64.decode(delta, Base64.DEFAULT)
        responseHasAudio = true
        muted.set(true)
        _state.update { it.copy(status = RealtimeStatus.Speaking) }
        ensureTrack().write(pcm, 0, pcm.size)
      }
      "response.output_audio.done", "response.audio.done", "response.done" -> {
        scope.launch {
          // Let the buffered tail finish before opening the mic again.
          if (responseHasAudio) delay(400)
          muted.set(false)
          if (_state.value.status == RealtimeStatus.Speaking || !responseHasAudio) _state.update { it.copy(status = RealtimeStatus.Listening) }
        }
      }
      "ping" -> webSocket.send(buildJsonObject { put("type", "pong"); event["ping_timestamp"]?.let { put("ping_timestamp", it) } }.toString())
      "error" -> fail(event["message"]?.jsonPrimitive?.contentOrNull ?: (event["error"] as? JsonObject)?.get("message")?.jsonPrimitive?.contentOrNull ?: "The live voice session hit a problem.")
    }
  }

  private fun upsertTurn(id: String, role: String, text: String, append: Boolean) {
    _state.update { state ->
      val index = state.turns.indexOfFirst { it.id == id }
      val turns =
        if (index < 0) state.turns + RealtimeTurn(id, role, text)
        else state.turns.toMutableList().also { it[index] = it[index].copy(text = if (append) it[index].text + text else text) }
      state.copy(turns = turns)
    }
  }

  @SuppressLint("MissingPermission")
  private fun startMicrophone(webSocket: WebSocket) {
    micJob?.cancel()
    micJob =
      scope.launch(Dispatchers.IO) {
        val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val record =
          try {
            AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuffer, SAMPLE_RATE / 5))
          } catch (e: Exception) {
            fail("Microphone access is off. Enable it in Settings to talk to Bee.")
            return@launch
          }
        if (record.state != AudioRecord.STATE_INITIALIZED) {
          fail("The microphone could not start.")
          return@launch
        }
        record.startRecording()
        val chunk = ByteArray(SAMPLE_RATE / 10 * 2)
        try {
          while (isActive) {
            val read = record.read(chunk, 0, chunk.size)
            if (read <= 0) continue
            // Keep the stream alive while Bee talks but do not echo the speaker back.
            val payload = if (muted.get()) ByteArray(read) else chunk.copyOf(read)
            webSocket.send(buildJsonObject { put("type", "input_audio_buffer.append"); put("audio", Base64.encodeToString(payload, Base64.NO_WRAP)) }.toString())
          }
        } finally {
          runCatching { record.stop() }
          record.release()
        }
      }
  }

  private fun ensureTrack(): AudioTrack =
    track
      ?: AudioTrack.Builder()
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(SAMPLE_RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
        .setBufferSizeInBytes(maxOf(AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT), SAMPLE_RATE * 2))
        .setTransferMode(AudioTrack.MODE_STREAM)
        .build()
        .also {
          it.play()
          track = it
        }

  private fun releaseTrack() {
    track?.let { current ->
      runCatching { current.pause() }
      runCatching { current.flush() }
      runCatching { current.release() }
    }
    track = null
  }

  private companion object {
    const val TAG = "BeeGreat"
  }
}
