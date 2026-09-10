package com.beegreat.convex

import android.content.Context
import com.clerk.convex.createClerkConvexClient
import dev.convex.android.ConvexClientWithAuth

/**
 * The one Convex client for the app. Clerk's session is synced into it by
 * `clerk-convex-kotlin`, so callers never pass tokens around.
 */
typealias BeeConvexClient = ConvexClientWithAuth<String>

fun createBeeConvexClient(context: Context, deploymentUrl: String): BeeConvexClient =
  createClerkConvexClient(deploymentUrl = deploymentUrl, context = context.applicationContext)
