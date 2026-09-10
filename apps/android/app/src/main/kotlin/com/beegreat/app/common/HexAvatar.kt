package com.beegreat.app.common

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.beegreat.design.Hive
import com.beegreat.design.hexagonPath

/** Pointy-top hexagon clip, rounded like the Skia path in `hex-avatar.tsx`. */
class HexShape(private val cornerRadius: Float = 0.12f) : Shape {
  override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline =
    Outline.Generic(hexagonPath(size.minDimension, 0f, size.minDimension * cornerRadius))
}

/** Hexagonal avatar in the honeycomb style; falls back to a comb-colored cell. */
@Composable
fun HexAvatar(size: Dp, imageUrl: String?, modifier: Modifier = Modifier) {
  Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
    Box(modifier = Modifier.fillMaxSize().clip(HexShape()).background(Hive.comb)) {
      if (imageUrl != null) {
        AsyncImage(model = imageUrl, contentDescription = "Profile", modifier = Modifier.fillMaxSize())
      }
    }
    Canvas(modifier = Modifier.fillMaxSize()) {
      drawPath(hexagonPath(this.size.minDimension, 1f * density, this.size.minDimension * 0.12f), Hive.amber, style = Stroke(1.5f * density))
    }
  }
}

/** A hexagonal 36px icon button, the top-bar control from `hex-icon-button.tsx`. */
@Composable
fun HexIconButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit, size: Dp = 36.dp, modifier: Modifier = Modifier) {
  Box(
    modifier = modifier.size(size).clip(HexShape()).background(Hive.comb).clickable(onClick = onClick),
    contentAlignment = Alignment.Center,
  ) {
    Icon(icon, contentDescription = contentDescription, tint = Hive.cacao, modifier = Modifier.size(size * 0.5f))
  }
}

@Composable
fun HexIconButton(painter: Painter, contentDescription: String, onClick: () -> Unit, size: Dp = 36.dp, modifier: Modifier = Modifier) {
  Box(
    modifier = modifier.size(size).clip(HexShape()).background(Hive.comb).clickable(onClick = onClick),
    contentAlignment = Alignment.Center,
  ) {
    Icon(painter, contentDescription = contentDescription, tint = Hive.cacao, modifier = Modifier.size(size * 0.5f))
  }
}
