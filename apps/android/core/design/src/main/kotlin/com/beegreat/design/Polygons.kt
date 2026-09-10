package com.beegreat.design

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

/** Closed polygon with each corner replaced by a quadratic curve. Port of `makeRoundedPolygonPath`. */
fun roundedPolygonPath(points: List<Offset>, cornerRadius: Float): Path {
  val path = Path()
  val count = points.size
  points.forEachIndexed { i, vertex ->
    val prev = points[(i + count - 1) % count]
    val next = points[(i + 1) % count]
    val toPrev = prev - vertex
    val toNext = next - vertex
    val prevLen = hypot(toPrev.x, toPrev.y)
    val nextLen = hypot(toNext.x, toNext.y)
    val rPrev = min(cornerRadius, prevLen / 2) / prevLen
    val rNext = min(cornerRadius, nextLen / 2) / nextLen
    val entry = vertex + toPrev * rPrev
    val exit = vertex + toNext * rNext
    if (i == 0) path.moveTo(entry.x, entry.y) else path.lineTo(entry.x, entry.y)
    path.quadraticTo(vertex.x, vertex.y, exit.x, exit.y)
  }
  path.close()
  return path
}

/** Pointy-top hexagon inside a `size` square, inset for the stroke. */
fun hexagonPath(size: Float, inset: Float, cornerRadius: Float): Path {
  val c = size / 2
  val radius = c - inset
  val points =
    List(6) { i ->
      val angle = (PI / 180) * (60 * i - 90)
      Offset(c + radius * cos(angle).toFloat(), c + radius * sin(angle).toFloat())
    }
  return roundedPolygonPath(points, cornerRadius)
}

/** Wide honeycomb cell: flat top and bottom, 120 degree pointed ends. */
fun wideHexagonPath(width: Float, height: Float, cornerRadius: Float): Path {
  val inset = height / (2 * kotlin.math.tan(PI / 3)).toFloat()
  return roundedPolygonPath(
    listOf(
      Offset(0f, height / 2),
      Offset(inset, 0f),
      Offset(width - inset, 0f),
      Offset(width, height / 2),
      Offset(width - inset, height),
      Offset(inset, height),
    ),
    cornerRadius,
  )
}
