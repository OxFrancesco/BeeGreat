package com.beegreat.convex.goals

import com.beegreat.convex.ConvexInt
import kotlinx.serialization.Serializable

/** One row of `goals:list`. Mirrors the return shape in `packages/backend/convex/goals.ts`. */
@Serializable
data class GoalSummary(
  val id: String,
  val title: String,
  val finalGoal: String? = null,
  val projectCount: ConvexInt,
  val openTasks: ConvexInt,
  val doneTasks: ConvexInt,
) {
  val totalTasks: Int
    get() = openTasks + doneTasks

  val progress: Float
    get() = if (totalTasks == 0) 0f else doneTasks.toFloat() / totalTasks
}
