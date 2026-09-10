package com.beegreat.convex

import android.content.Context
import dev.convex.android.ConvexClientWithAuth

/**
 * The one Convex client for the app. Clerk's session is synced into it by
 * [ClerkConvexAuthProvider], so callers never pass tokens around.
 */
typealias BeeConvexClient = ConvexClientWithAuth<String>

fun createBeeConvexClient(context: Context, deploymentUrl: String): BeeConvexClient =
  ClerkConvexAuthProvider().createClient(deploymentUrl, context)
