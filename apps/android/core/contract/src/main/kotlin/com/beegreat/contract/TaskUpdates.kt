package com.beegreat.contract

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class TaskUpdateState { Pending, Failed }

/** Mirrors chat-sync's pending lock and retry state without changing saved task data. */
class TaskUpdates {
  private val mutableStates = MutableStateFlow<Map<String, TaskUpdateState>>(emptyMap())
  val states = mutableStates.asStateFlow()

  suspend fun run(id: String, update: suspend () -> Unit) {
    synchronized(this) {
      if (mutableStates.value[id] == TaskUpdateState.Pending) return
      mutableStates.update { it + (id to TaskUpdateState.Pending) }
    }
    try {
      update()
      mutableStates.update { it - id }
    } catch (canceled: CancellationException) {
      mutableStates.update { it - id }
      throw canceled
    } catch (_: Exception) {
      mutableStates.update { it + (id to TaskUpdateState.Failed) }
    }
  }
}
