package com.beegreat.convex.user

import com.beegreat.convex.BeeConvexClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UserRepository(private val convex: BeeConvexClient) {
  /** Scheduling falls back to UTC when this has not run. */
  suspend fun syncTimeZone(timeZone: String) =
    withContext(Dispatchers.IO) { convex.mutation("user:syncTimeZone", mapOf("timeZone" to timeZone)) }
}
