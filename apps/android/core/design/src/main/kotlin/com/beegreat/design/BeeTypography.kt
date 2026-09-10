package com.beegreat.design

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Text scale from `ThemedText` in the Expo app. Android has no rounded system
 * face, so display styles use the default sans at the same weight.
 */
@Immutable
data class BeeTypography(
  val title: TextStyle =
    TextStyle(fontSize = 48.sp, lineHeight = 52.sp, fontWeight = FontWeight.SemiBold),
  val subtitle: TextStyle =
    TextStyle(fontSize = 32.sp, lineHeight = 44.sp, fontWeight = FontWeight.SemiBold),
  val sectionTitle: TextStyle =
    TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
  val barTitle: TextStyle =
    TextStyle(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
  val chatBody: TextStyle =
    TextStyle(fontSize = 17.sp, lineHeight = 26.sp, fontWeight = FontWeight.Normal),
  val body: TextStyle =
    TextStyle(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium),
  val small: TextStyle =
    TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Medium),
  val smallBold: TextStyle =
    TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold),
  val code: TextStyle =
    TextStyle(
      fontSize = 12.sp,
      lineHeight = 16.sp,
      fontWeight = FontWeight.Medium,
      fontFamily = FontFamily.Monospace,
    ),
)
