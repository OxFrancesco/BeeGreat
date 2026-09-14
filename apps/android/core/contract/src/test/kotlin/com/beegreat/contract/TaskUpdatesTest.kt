package com.beegreat.contract

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class TaskUpdatesTest {
  @Test fun pendingTaskIsLockedWhileOtherTasksCanRun() = runTest {
    val updates = TaskUpdates()
    val release = CompletableDeferred<Unit>()
    var calls = 0
    val first = launch { updates.run("a") { calls++; release.await() } }
    runCurrent()
    updates.run("a") { calls++ }
    updates.run("b") { calls++ }
    assertEquals(2, calls)
    assertEquals(mapOf("a" to TaskUpdateState.Pending), updates.states.value)
    release.complete(Unit)
    first.join()
    assertTrue(updates.states.value.isEmpty())
  }

  @Test fun failedTaskCanRetryAndCancellationReleasesTheLock() = runTest {
    val updates = TaskUpdates()
    updates.run("a") { error("offline") }
    assertEquals(TaskUpdateState.Failed, updates.states.value["a"])
    updates.run("a") {}
    assertTrue(updates.states.value.isEmpty())
    val pending = launch { updates.run("a") { CompletableDeferred<Unit>().await() } }
    runCurrent()
    pending.cancel()
    pending.join()
    assertTrue(updates.states.value.isEmpty())
  }
}
