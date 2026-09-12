package com.beegreat.app.healthy

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.convex.health.HealthCalendarDay
import com.beegreat.design.BeeTheme
import com.beegreat.design.hexagonPath
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

private val ringColors = listOf(Color(0xFF75A469), Color(0xFF55BEE2), Color(0xFFE4A72C))
private val trackerLabels = listOf("Mood", "Water", "Journal")

@Composable
fun HealthStreaks(throughDate: String) {
  val today = LocalDate.now()
  var monthKey by rememberSaveable { mutableStateOf(throughDate.take(7)) }
  val month = YearMonth.parse(monthKey)
  val end = minOf(month.atEndOfMonth(), today).toString()
  val repo = LocalAppContainer.current.health
  val flow = remember(end) { repo.overview(end) }
  val result by flow.collectAsStateWithLifecycle(initialValue = null)
  val overview = result?.getOrNull()
  val colors = BeeTheme.colors
  val startOffset = month.atDay(1).dayOfWeek.value - 1
  val rows = (startOffset + month.lengthOfMonth() + 6) / 7
  Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
      Text(month.atDay(1).format(DateTimeFormatter.ofPattern("MMMM yyyy")), Modifier.weight(1f), style = BeeTheme.typography.sectionTitle, color = colors.text)
      IconButton(onClick = { monthKey = month.minusMonths(1).toString() }) {
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous month", tint = colors.textSecondary)
      }
      IconButton(enabled = month < YearMonth.from(today), onClick = { val next = month.plusMonths(1); monthKey = next.toString() }) {
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next month", tint = if (month < YearMonth.from(today)) colors.textSecondary else colors.border)
      }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      trackerLabels.forEachIndexed { index, label ->
        val streak = overview?.let { listOf(it.mood, it.water, it.journal)[index] }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(label, style = BeeTheme.typography.small, color = ringColors[index])
          Text(streak?.let { if (it.windowDays == 0) "—" else "${it.current}${if (it.currentCapped) "+" else ""} ${if (it.current == 1) "day" else "days"}" } ?: "—", style = BeeTheme.typography.barTitle, color = colors.text)
        }
      }
    }
    if (overview == null) {
      Text(if (result?.isFailure == true) "Calendar unavailable. Reopen to retry." else "Loading calendar…", style = BeeTheme.typography.small, color = colors.textSecondary)
    } else {
      BoxWithConstraints(Modifier.fillMaxWidth()) {
        val diameter = maxWidth / 6.63f
        val pitch = diameter * .866f
        Box(Modifier.fillMaxWidth().height(diameter * (1 + (rows - 1) * .75f))) {
          for (number in 1..month.lengthOfMonth()) {
            val slot = startOffset + number - 1
            val row = slot / 7
            val col = slot % 7
            val date = month.atDay(number)
            val key = date.toString()
            val day = overview.calendar.find { it.localDate == key }
            val future = date > today
            Box(Modifier.offset(x = pitch * (col + (row % 2) * .5f), y = diameter * (row * .75f))
              .size(diameter)
              .semantics(mergeDescendants = true) { contentDescription = "${date.format(DateTimeFormatter.ofPattern("EEEE, MMMM d"))}. ${if (future) "Future day" else dayDescription(day)}" }, contentAlignment = Alignment.Center) {
              Canvas(Modifier.fillMaxSize()) {
                val px = size.width
                val path = hexagonPath(px, 2.dp.toPx(), 3.dp.toPx())
                drawPath(path, colors.card)
                drawPath(path, if (date == today) colors.primary else colors.border, style = Stroke(if (date == today) 1.5.dp.toPx() else 1.dp.toPx()))
                val progress = listOf(if (day?.mood == true) 1f else 0f, day?.water?.toFloat() ?: 0f, if (day?.journal == true) 1f else 0f)
                progress.forEachIndexed { index, value ->
                  val radius = px * (.38f - index * .09f)
                  val ring = hexagonPath(px, px / 2 - radius, 0f)
                  val stroke = Stroke(width = px * .043f, cap = StrokeCap.Round, join = StrokeJoin.Round)
                  drawPath(ring, ringColors[index].copy(alpha = if (future) .07f else .16f), style = stroke)
                  if (value > 0f) {
                    val measure = PathMeasure().apply { setPath(ring, true) }
                    val filled = Path()
                    measure.getSegment(0f, measure.length * value.coerceIn(0f, 1f), filled, true)
                    drawPath(if (value >= 1f) ring else filled, ringColors[index], style = stroke)
                  }
                }
              }
              Text(number.toString(), color = if (future) colors.textSecondary.copy(alpha = .4f) else colors.text, fontSize = 10.sp, lineHeight = 12.sp)
            }
          }
        }
      }
    }
  }
}

private fun dayDescription(day: HealthCalendarDay?): String =
  "Mood ${if (day?.mood == true) "logged" else "not logged"}. Water ${((day?.water ?: 0.0) * 100).toInt()} percent. Journal ${when (day?.journal) { true -> "logged"; false -> "not logged"; null -> "history unavailable" }}"
