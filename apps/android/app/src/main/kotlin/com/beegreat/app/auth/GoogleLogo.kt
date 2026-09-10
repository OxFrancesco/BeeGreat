package com.beegreat.app.auth

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** The four-color "G" ring, drawn instead of shipped as an asset. */
@Composable
fun GoogleLogo(size: Dp = 20.dp) {
  Canvas(modifier = Modifier.size(size)) {
    val stroke = this.size.width * 0.22f
    val inset = stroke / 2
    val arcSize = Size(this.size.width - stroke, this.size.height - stroke)
    val topLeft = Offset(inset, inset)
    val style = Stroke(width = stroke)
    drawArc(Color(0xFFEA4335), startAngle = 180f, sweepAngle = 90f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
    drawArc(Color(0xFFFBBC05), startAngle = 90f, sweepAngle = 90f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
    drawArc(Color(0xFF34A853), startAngle = 20f, sweepAngle = 70f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
    drawArc(Color(0xFF4285F4), startAngle = -45f, sweepAngle = 45f, useCenter = false, topLeft = topLeft, size = arcSize, style = style)
    drawLine(
      Color(0xFF4285F4),
      start = Offset(this.size.width / 2, this.size.height / 2),
      end = Offset(this.size.width - inset, this.size.height / 2),
      strokeWidth = stroke,
    )
  }
}
