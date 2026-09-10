package com.beegreat.convex

import com.beegreat.convex.goals.GoalSummary
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ConvexSerializersTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun `decodes whole floats as ints`() {
    val goal =
      json.decodeFromString<GoalSummary>(
        """{"id":"g1","title":"Ship","finalGoal":null,"projectCount":2.0,"openTasks":3,"doneTasks":1.0}"""
      )
    assertEquals(2, goal.projectCount)
    assertEquals(3, goal.openTasks)
    assertEquals(1, goal.doneTasks)
    assertEquals(0.25f, goal.progress)
  }

  @Test
  fun `decodes convex integer envelopes`() {
    // 7 as a little-endian int64.
    val goal =
      json.decodeFromString<GoalSummary>(
        """{"id":"g1","title":"Ship","projectCount":{"${'$'}integer":"BwAAAAAAAAA="},"openTasks":0,"doneTasks":0}"""
      )
    assertEquals(7, goal.projectCount)
    assertEquals(0f, goal.progress)
  }
}
