package com.beegreat.design

import android.provider.Settings
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/** Mirrors `apps/mobile/src/constants/motion.ts`. All state transitions live in 100 to 240ms. */
object Motion {
  const val pressIn = 100
  const val pressOut = 160
  const val exit = 150
  const val enter = 200
  const val progress = 240

  val easeOut = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)
  val easeInOut = CubicBezierEasing(0.77f, 0f, 0.175f, 1f)

  const val pressedScale = 0.97f
  const val enterScale = 0.94f

  fun <T> progressSpec() = tween<T>(durationMillis = progress, easing = easeOut)

  fun <T> enterSpec() = tween<T>(durationMillis = enter, easing = easeOut)

  /** True when the system animator scale is off; continuous motion must then hold still. */
  @Composable
  fun reducedMotion(): Boolean {
    val context = LocalContext.current
    return Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
  }
}
