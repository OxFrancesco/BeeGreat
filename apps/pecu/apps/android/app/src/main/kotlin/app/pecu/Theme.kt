package app.pecu

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.background
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.draw.innerShadow
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

val Amber = Color(0xFFF59E0B)
val Brown = Color(0xFF92400E)
val Inter = FontFamily(Font(R.font.inter))
val Mono = FontFamily(Font(R.font.jetbrains_mono))

@Composable fun PecuTheme(content: @Composable () -> Unit) {
  val colors = if (isSystemInDarkTheme()) darkColorScheme(
    primary = Amber, onPrimary = Color.Black, background = Color(0xFF171717), surface = Color(0xFF262626),
    onSurface = Color(0xFFE5E5E5), onBackground = Color(0xFFE5E5E5), surfaceVariant = Color(0xFF303030),
    onSurfaceVariant = Color(0xFFA3A3A3), secondaryContainer = Color(0xFF78350F), outlineVariant = Color(0xFF404040),
  ) else lightColorScheme(
    primary = Amber, onPrimary = Color.Black, background = Color.White, surface = Color.White,
    onSurface = Color(0xFF262626), onBackground = Color(0xFF262626), surfaceVariant = Color(0xFFF3F4F6),
    onSurfaceVariant = Color(0xFF6B7280), secondaryContainer = Color(0xFFFFFBEB), outlineVariant = Color(0xFFE5E7EB),
  )
  val type = Typography()
  MaterialTheme(colorScheme = colors, typography = Typography(
    bodyLarge = type.bodyLarge.copy(fontFamily = Inter), bodyMedium = type.bodyMedium.copy(fontFamily = Inter),
    bodySmall = type.bodySmall.copy(fontFamily = Inter), titleLarge = type.titleLarge.copy(fontFamily = Inter, fontWeight = FontWeight.SemiBold),
    titleMedium = type.titleMedium.copy(fontFamily = Inter, fontWeight = FontWeight.SemiBold),
    headlineLarge = type.headlineLarge.copy(fontFamily = Inter, fontWeight = FontWeight.Bold),
    headlineMedium = type.headlineMedium.copy(fontFamily = Inter, fontWeight = FontWeight.Bold),
    labelLarge = type.labelLarge.copy(fontFamily = Inter), labelMedium = type.labelMedium.copy(fontFamily = Inter),
  ), content = content)
}

fun Modifier.clay(radius: Int = 22) = shadow(6.dp, RoundedCornerShape(radius.dp), ambientColor = Color(0x18262626), spotColor = Color(0x20262626))
  .drawWithCache {
    val highlight = Brush.linearGradient(listOf(Color.White.copy(alpha = .6f), Color.Transparent, Color.Black.copy(alpha = .06f)))
    val corner = CornerRadius(radius.dp.toPx())
    onDrawWithContent { drawContent(); drawRoundRect(highlight, cornerRadius = corner, style = Stroke(2.dp.toPx())) }
  }

// Pecu theme/clay.css: soft outer lift and opposing inset light/shade.
fun Modifier.clayMaterial(fill: Color, primary: Boolean = false, radius: Int = 22): Modifier {
  val shape = RoundedCornerShape(radius.dp)
  return this
    .dropShadow(shape, Shadow(radius = 12.dp, offset = DpOffset(4.dp, 5.dp), color = if (primary) Amber.copy(alpha = .24f) else Color.Black.copy(alpha = .16f)))
    .background(fill, shape)
    .innerShadow(shape, Shadow(radius = 4.dp, offset = DpOffset(2.dp, 2.dp), color = Color.White.copy(alpha = if (primary) .42f else .13f)))
    .innerShadow(shape, Shadow(radius = 6.dp, offset = DpOffset((-3).dp, (-3).dp), color = Color.Black.copy(alpha = if (primary) .20f else .22f)))
}
