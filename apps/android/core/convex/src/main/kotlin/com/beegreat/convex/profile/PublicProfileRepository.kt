package com.beegreat.convex.profile

import com.beegreat.convex.BeeConvexClient
import com.beegreat.convex.ConvexLong
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/** `instagram`, `linkedin`, `x`, `github`, `youtube`, `tiktok`, `facebook`, or `website`. */
@Serializable data class ProfileLink(val provider: String, val label: String, val url: String)

@Serializable
data class PublicProfile(
  val handle: String,
  val displayName: String,
  val bio: String? = null,
  val avatarUrl: String? = null,
  val published: Boolean,
  val profileUrl: String,
  val qrUrl: String,
  val links: List<ProfileLink> = emptyList(),
  val updatedAt: ConvexLong,
)

class PublicProfileRepository(private val convex: BeeConvexClient) {
  fun mine(): Flow<Result<PublicProfile?>> = convex.subscribe("publicProfiles:mine")

  suspend fun ensureMine(displayName: String, suggestedHandle: String?, avatarUrl: String?): PublicProfile =
    io {
      convex.mutation<PublicProfile>(
        "publicProfiles:ensureMine",
        buildMap {
          put("displayName", displayName)
          if (suggestedHandle != null) put("suggestedHandle", suggestedHandle)
          if (avatarUrl != null) put("avatarUrl", avatarUrl)
        },
      )
    }

  suspend fun saveMine(handle: String, displayName: String, bio: String?, avatarUrl: String?, published: Boolean, links: List<ProfileLink>): PublicProfile =
    io {
      convex.mutation<PublicProfile>(
        "publicProfiles:saveMine",
        buildMap {
          put("handle", handle)
          put("displayName", displayName)
          if (bio != null) put("bio", bio)
          if (avatarUrl != null) put("avatarUrl", avatarUrl)
          put("published", published)
          put("links", links.map { mapOf("provider" to it.provider, "label" to it.label, "url" to it.url) })
        },
      )
    }

  private suspend inline fun <T> io(crossinline block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }
}
