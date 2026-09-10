package com.beegreat.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

private val LocalBeeColors = staticCompositionLocalOf { LightBeeColors }
private val LocalBeeTypography = staticCompositionLocalOf { BeeTypography() }

object BeeTheme {
  val colors: BeeColors
    @Composable @ReadOnlyComposable get() = LocalBeeColors.current

  val typography: BeeTypography
    @Composable @ReadOnlyComposable get() = LocalBeeTypography.current
}

/**
 * Provides the hive palette and text scale, and maps them onto Material 3 so
 * stock components (sheets, text fields, switches) pick up the same colors.
 */
@Composable
fun BeeTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
  val colors = if (darkTheme) DarkBeeColors else LightBeeColors
  val scheme =
    if (darkTheme) {
      darkColorScheme(
        primary = colors.primary,
        onPrimary = colors.primaryForeground,
        secondary = colors.secondary,
        onSecondary = colors.secondaryForeground,
        secondaryContainer = colors.secondary,
        onSecondaryContainer = colors.secondaryForeground,
        background = colors.background,
        onBackground = colors.text,
        surface = colors.background,
        onSurface = colors.text,
        surfaceVariant = colors.backgroundElement,
        onSurfaceVariant = colors.textSecondary,
        surfaceContainer = colors.card,
        surfaceContainerLow = colors.card,
        surfaceContainerHigh = colors.backgroundElement,
        outline = colors.border,
        outlineVariant = colors.border,
        error = colors.destructive,
      )
    } else {
      lightColorScheme(
        primary = colors.primary,
        onPrimary = colors.primaryForeground,
        secondary = colors.secondary,
        onSecondary = colors.secondaryForeground,
        secondaryContainer = colors.secondary,
        onSecondaryContainer = colors.secondaryForeground,
        background = colors.background,
        onBackground = colors.text,
        surface = colors.background,
        onSurface = colors.text,
        surfaceVariant = colors.backgroundElement,
        onSurfaceVariant = colors.textSecondary,
        surfaceContainer = colors.card,
        surfaceContainerLow = colors.card,
        surfaceContainerHigh = colors.backgroundElement,
        outline = colors.border,
        outlineVariant = colors.border,
        error = colors.destructive,
      )
    }
  CompositionLocalProvider(
    LocalBeeColors provides colors,
    LocalBeeTypography provides BeeTypography(),
  ) {
    MaterialTheme(colorScheme = scheme, content = content)
  }
}
