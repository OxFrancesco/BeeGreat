package com.beegreat.design

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/** Canonical BeeGreat palette. Mirrors `apps/mobile/src/constants/theme.ts`. */
@Immutable
data class BeeColors(
  val text: Color,
  val textSecondary: Color,
  val background: Color,
  val backgroundElement: Color,
  val backgroundSelected: Color,
  val card: Color,
  val border: Color,
  val primary: Color,
  val primaryForeground: Color,
  val secondary: Color,
  val secondaryForeground: Color,
  val destructive: Color,
  val isDark: Boolean,
)

val LightBeeColors =
  BeeColors(
    text = Color(0xFF202020),
    textSecondary = Color(0xFF646464),
    background = Color(0xFFF9F9F9),
    backgroundElement = Color(0xFFEFEFEF),
    backgroundSelected = Color(0xFFE8E8E8),
    card = Color(0xFFFCFCFC),
    border = Color(0xFFD8D8D8),
    primary = Color(0xFF644A40),
    primaryForeground = Color(0xFFFFFFFF),
    secondary = Color(0xFFFFDFB5),
    secondaryForeground = Color(0xFF582D1D),
    destructive = Color(0xFFE54D2E),
    isDark = false,
  )

val DarkBeeColors =
  BeeColors(
    text = Color(0xFFEEEEEE),
    textSecondary = Color(0xFFB4B4B4),
    background = Color(0xFF111111),
    backgroundElement = Color(0xFF222222),
    backgroundSelected = Color(0xFF2A2A2A),
    card = Color(0xFF191919),
    border = Color(0xFF201E18),
    primary = Color(0xFFFFE0C2),
    primaryForeground = Color(0xFF081A1B),
    secondary = Color(0xFF393028),
    secondaryForeground = Color(0xFFFFE0C2),
    destructive = Color(0xFFE54D2E),
    isDark = true,
  )

/** Honeycomb accents from `docs/design/Initial-Page.svg`, shared with the sign-in scene. */
object Hive {
  val cream = Color(0xFFFEF6E5)
  val comb = Color(0xFFFFDFB5)
  val honey = Color(0xFFFAB52A)
  val amber = Color(0xFFD88909)
  val cacao = Color(0xFF482401)
  val bark = Color(0xFF794D20)
  val wax = Color(0xFFFFF3DC)
}

/** Icon-mark tile used on cards and section chips. */
object HoneyTile {
  val fill = Color(0xFFFFF0C2)
  val ink = Color(0xFF6D4B0D)
}
