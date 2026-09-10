package com.beegreat.app.goals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.beegreat.convex.goals.GoalSummary
import com.beegreat.convex.goals.GoalsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface GoalsUiState {
  data object Loading : GoalsUiState

  data class Loaded(val goals: List<GoalSummary>) : GoalsUiState

  data class Failed(val message: String) : GoalsUiState
}

class GoalsViewModel(private val repository: GoalsRepository) : ViewModel() {
  val state: StateFlow<GoalsUiState> =
    repository
      .goals()
      .catch { emit(Result.failure(it)) }
      .map { result ->
        result.fold(
          onSuccess = { GoalsUiState.Loaded(it) },
          onFailure = { GoalsUiState.Failed(it.message ?: "Goals could not load.") },
        )
      }
      .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), GoalsUiState.Loading)

  private val _notice = MutableStateFlow<String?>(null)
  val notice: StateFlow<String?> = _notice.asStateFlow()

  fun addGoal(title: String) = run("Could not add goal") { repository.create(title) }

  fun renameGoal(goalId: String, title: String) =
    run("Could not rename goal") { repository.rename(goalId, title) }

  fun removeGoal(goalId: String) = run("Could not delete goal") { repository.remove(goalId) }

  fun dismissNotice() {
    _notice.value = null
  }

  private fun run(failure: String, block: suspend () -> Unit) {
    viewModelScope.launch {
      try {
        block()
      } catch (e: Exception) {
        _notice.value = e.message?.let { "$failure: $it" } ?: failure
      }
    }
  }
}
