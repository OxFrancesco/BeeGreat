package com.beegreat.app.voice

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class VoiceMode {
  VoiceNote,
  Conversation,
}

/** Port of `apps/mobile/src/lib/preferences.ts`: speak replies (default on) and the Talk button's mode. */
class Preferences(context: Context) {
  private val store = context.getSharedPreferences("bee.preferences", Context.MODE_PRIVATE)

  private val _speakReplies = MutableStateFlow(store.getString(SPEAK_REPLIES, "on") != "off")
  val speakReplies: StateFlow<Boolean> = _speakReplies

  private val _voiceMode = MutableStateFlow(if (store.getString(VOICE_MODE, null) == "conversation") VoiceMode.Conversation else VoiceMode.VoiceNote)
  val voiceMode: StateFlow<VoiceMode> = _voiceMode

  fun setSpeakReplies(enabled: Boolean) {
    _speakReplies.value = enabled
    store.edit().putString(SPEAK_REPLIES, if (enabled) "on" else "off").apply()
  }

  fun setVoiceMode(mode: VoiceMode) {
    _voiceMode.value = mode
    store.edit().putString(VOICE_MODE, if (mode == VoiceMode.Conversation) "conversation" else "voice-note").apply()
  }

  private companion object {
    const val SPEAK_REPLIES = "bee.speakReplies"
    const val VOICE_MODE = "bee.voiceMode"
  }
}
