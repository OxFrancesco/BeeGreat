package com.beegreat.app.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import com.beegreat.app.bee.BeeAgentController
import com.beegreat.contract.extractBeeUi
import com.beegreat.contract.getToolCopy
import com.beegreat.contract.ToolActivityState
import com.beegreat.flue.AgentStatus
import com.beegreat.flue.FlueMessage
import com.beegreat.flue.FluePart
import com.beegreat.flue.isStreaming
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class OrbState {
  Idle,
  Listening,
  Thinking,
  Speaking,
}

data class VoiceNoteState(
  val recording: Boolean = false,
  val transcribing: Boolean = false,
  val speaking: Boolean = false,
  val orbState: OrbState = OrbState.Idle,
  /** What Bee is doing, for the notification and the island: the running tool's copy. */
  val activityDetail: String? = null,
)

/**
 * Push-to-talk voice notes and spoken replies. Port of the audio half of
 * `useVoiceAgent`: record m4a, transcribe through the worker, send the text as
 * a normal turn; when a reply settles and speak-replies is on, synthesize it
 * and play it once. New threads restart the speech bookkeeping.
 */
class VoiceNoteController(
  private val context: Context,
  private val agent: BeeAgentController,
  private val api: VoiceApi,
  private val preferences: Preferences,
  private val scope: CoroutineScope,
) {
  private val _state = MutableStateFlow(VoiceNoteState())
  val state: StateFlow<VoiceNoteState> = _state.asStateFlow()

  private var recorder: MediaRecorder? = null
  private var recordingFile: File? = null
  private var player: MediaPlayer? = null
  private var speechJob: Job? = null
  private var speechGeneration = 0
  private var spokenIds = HashSet<String>()
  private var seededThread: Long? = null

  fun start() {
    combine(agent.state, preferences.speakReplies) { agentState, speak -> agentState to speak }
      .onEach { (agentState, speak) -> considerSpeaking(agentState.thread, agentState.status, agentState.messages, speak) }
      .launchIn(scope)
    agent.state.onEach { publish(busy = it.busy, detail = runningToolDetail(it.messages)) }.launchIn(scope)
  }

  private var busy = false
  private var detail: String? = null

  private fun publish(busy: Boolean = this.busy, detail: String? = this.detail) {
    this.busy = busy
    this.detail = detail
    val current = _state.value
    val orb =
      when {
        current.recording -> OrbState.Listening
        current.transcribing || busy -> OrbState.Thinking
        current.speaking -> OrbState.Speaking
        else -> OrbState.Idle
      }
    _state.value = current.copy(orbState = orb, activityDetail = detail)
    VoiceSessionService.update(context, orb, detail)
  }

  private fun runningToolDetail(messages: List<FlueMessage>): String? {
    val last = messages.lastOrNull { it.isAssistant } ?: return null
    val running = last.parts.filterIsInstance<FluePart.Tool>().lastOrNull { it.state == "input-available" } ?: return null
    return getToolCopy(running.toolName, ToolActivityState.Running, running.input).label
  }

  /** Toggles recording. Stopping transcribes and sends; the mic permission must already be granted. */
  suspend fun toggleRecording() {
    agent.voiceError.value = null
    if (_state.value.recording) {
      finishRecording()
      return
    }
    stopSpeech()
    try {
      val file = File(context.cacheDir, "bee-note-${System.currentTimeMillis()}.m4a")
      val recorder = (if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()).apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioSamplingRate(44_100)
        setAudioEncodingBitRate(128_000)
        setOutputFile(file.absolutePath)
        prepare()
        start()
      }
      this.recorder = recorder
      recordingFile = file
      _state.value = _state.value.copy(recording = true)
      publish()
    } catch (e: Exception) {
      Log.w(TAG, "voice.record", e)
      agent.voiceError.value = e.message ?: "Something went wrong."
      releaseRecorder()
    }
  }

  private suspend fun finishRecording() {
    val file = recordingFile
    _state.value = _state.value.copy(recording = false, transcribing = true)
    publish()
    try {
      releaseRecorder(stop = true)
      if (file == null || !file.exists() || file.length() == 0L) throw IllegalStateException("Nothing was recorded.")
      val transcript = api.transcribe(file)
      if (transcript.isEmpty()) agent.voiceError.value = "I didn’t catch that — try again."
      else agent.sendText(transcript)
    } catch (e: Exception) {
      Log.w(TAG, "voice.transcribe", e)
      agent.voiceError.value = e.message ?: "Something went wrong."
    } finally {
      file?.delete()
      recordingFile = null
      _state.value = _state.value.copy(transcribing = false)
      publish()
    }
  }

  private fun releaseRecorder(stop: Boolean = false) {
    recorder?.let { current ->
      runCatching { if (stop) current.stop() }
      runCatching { current.release() }
    }
    recorder = null
  }

  fun stopSpeech() {
    speechGeneration++
    speechJob?.cancel()
    speechJob = null
    player?.let { current ->
      runCatching { current.stop() }
      runCatching { current.release() }
    }
    player = null
    if (_state.value.speaking) {
      _state.value = _state.value.copy(speaking = false)
      publish()
    }
  }

  private fun considerSpeaking(thread: Long, status: AgentStatus, messages: List<FlueMessage>, speak: Boolean) {
    if (seededThread != thread) {
      // Everything already in the transcript was said before; only new replies get read.
      seededThread = thread
      spokenIds = messages.filter { it.isAssistant }.map { it.id }.toHashSet()
      stopSpeech()
      return
    }
    if (status != AgentStatus.Idle) return
    val latest = messages.lastOrNull { it.isAssistant } ?: return
    if (latest.id in spokenIds) return
    if (latest.parts.any { it is FluePart.Text && it.isStreaming }) return
    spokenIds += latest.id
    if (!speak) return
    val spoken = extractBeeUi(latest.text).spoken
    if (spoken.isBlank()) return
    val generation = ++speechGeneration
    speechJob = scope.launch {
      try {
        val bytes = api.speak(spoken)
        if (generation != speechGeneration) return@launch
        val file = File(context.cacheDir, "bee-tts-$generation.mp3")
        withContext(Dispatchers.IO) { file.writeBytes(bytes) }
        play(file, generation)
      } catch (e: Exception) {
        Log.w(TAG, "voice.speak", e)
      }
    }
  }

  private fun play(file: File, generation: Int) {
    if (generation != speechGeneration) {
      file.delete()
      return
    }
    val mediaPlayer =
      MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        setDataSource(file.absolutePath)
        setOnCompletionListener {
          file.delete()
          if (player === this) {
            player = null
            runCatching { release() }
            _state.value = _state.value.copy(speaking = false)
            publish()
          }
        }
        setOnErrorListener { _, _, _ ->
          file.delete()
          stopSpeech()
          true
        }
        prepare()
      }
    player = mediaPlayer
    _state.value = _state.value.copy(speaking = true)
    publish()
    mediaPlayer.start()
  }

  private companion object {
    const val TAG = "BeeGreat"
  }
}
