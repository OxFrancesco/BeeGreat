package com.beegreat.app.profile

import android.content.Context
import android.util.Log
import com.beegreat.convex.account.AccountDeletionRepository
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.clerk.api.user.delete
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Port of `use-account-deletion.ts`. Order matters: prepare the BeeGreat job,
 * mark identity deletion, delete the Clerk user, then activate the data wipe.
 * The pending job is persisted so a crash mid-way resumes on next launch and
 * no half-deleted account is left behind. Android has no Apple token to revoke.
 */
class AccountDeletion(context: Context, private val repository: AccountDeletionRepository) {
  private val store = context.getSharedPreferences("bee.account-deletion", Context.MODE_PRIVATE)

  private val _deleting = MutableStateFlow(false)
  val deleting: StateFlow<Boolean> = _deleting

  private val _error = MutableStateFlow<String?>(null)
  val error: StateFlow<String?> = _error

  /** Finishes a deletion the previous run started but did not activate. */
  suspend fun resume() {
    val jobId = store.getString(JOB_ID, null) ?: return
    val token = store.getString(TOKEN, null) ?: return
    val phase = store.getString(PHASE, null)
    if (phase == "identity_deleted" || phase == "identity_deleting") {
      runCatching { repository.activate(jobId, token) }.onSuccess { clear(); runCatching { Clerk.auth.signOut() } }.onFailure { Log.w(TAG, "account.delete_resume", it) }
    }
  }

  suspend fun deleteAccount() {
    if (_deleting.value) return
    val user = Clerk.userFlow.value ?: return
    _deleting.value = true
    _error.value = null
    val token = UUID.randomUUID().toString()
    var jobId: String? = null
    var identityDeleted = false
    try {
      jobId = repository.prepare(token).jobId
      save(jobId, token, "prepared")
      repository.beginIdentityDeletion(jobId, token)
      save(jobId, token, "identity_deleting")
      when (val result = user.delete()) {
        is ClerkResult.Success -> Unit
        is ClerkResult.Failure -> throw IllegalStateException(result.error?.toString() ?: "Clerk could not delete the account.")
      }
      identityDeleted = true
      save(jobId, token, "identity_deleted")
      repository.activate(jobId, token)
      clear()
      runCatching { Clerk.auth.signOut() }
    } catch (e: Exception) {
      Log.w(TAG, "account.delete", e)
      var cancelled = false
      if (!identityDeleted && jobId != null) {
        runCatching { repository.cancel(jobId, token) }.onSuccess { if (it.status == "cancelled") { cancelled = true; clear() } }
      }
      _error.value =
        when {
          identityDeleted -> "Your sign-in account was deleted. BeeGreat data cleanup will retry automatically when the app is online."
          cancelled -> "Couldn't delete your account. No BeeGreat data was erased. Please try again or contact support."
          else -> "BeeGreat couldn't confirm whether account deletion completed. Try signing in again; if that fails, contact support."
        }
      if (identityDeleted) runCatching { Clerk.auth.signOut() }
    } finally {
      _deleting.value = false
    }
  }

  private fun save(jobId: String, token: String, phase: String) = store.edit().putString(JOB_ID, jobId).putString(TOKEN, token).putString(PHASE, phase).apply()

  private fun clear() = store.edit().clear().apply()

  private companion object {
    const val TAG = "BeeGreat"
    const val JOB_ID = "jobId"
    const val TOKEN = "activationToken"
    const val PHASE = "phase"
  }
}
