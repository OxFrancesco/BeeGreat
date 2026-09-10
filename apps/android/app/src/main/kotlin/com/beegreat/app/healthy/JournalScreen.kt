package com.beegreat.app.healthy

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.dateFromLocalKey
import com.beegreat.contract.formatJournalDate
import com.beegreat.contract.localDateKey
import com.beegreat.contract.monthStartKey
import com.beegreat.convex.health.JournalEntry
import com.beegreat.convex.health.JournalMonthDay
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.Hairline
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.TimeZone
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** Port of `journal-screen.tsx`: recent entries, a month calendar, search, and a new-entry button. */
@Composable
fun JournalScreen(localDate: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  var calendarVisible by remember { mutableStateOf(false) }
  var searchVisible by remember { mutableStateOf(false) }
  var search by remember { mutableStateOf("") }
  var month by remember { mutableStateOf(monthStartKey(localDate)) }
  var selectedDay by remember { mutableStateOf<String?>(null) }
  var creating by remember { mutableStateOf(false) }

  val entriesFlow =
    remember(localDate) {
      container.health.recentEntries(localDateKey(LocalDate.now().plusDays(1)), 60).map { it.getOrNull() ?: emptyList() }
    }
  val entries by entriesFlow.collectAsStateWithLifecycle(initialValue = emptyList())
  val monthFlow = remember(month) { container.health.month(month).map { it.getOrNull() ?: emptyList() } }
  val monthDays by monthFlow.collectAsStateWithLifecycle(initialValue = emptyList())
  val query = search.trim()
  val shown = remember(entries, query, selectedDay) {
    entries
      .filter { selectedDay == null || it.localDate == selectedDay }
      .filter { query.isEmpty() || it.title.contains(query, ignoreCase = true) || it.body.contains(query, ignoreCase = true) || it.tags.any { t -> t.contains(query, ignoreCase = true) } }
      .sortedWith(compareByDescending<JournalEntry> { it.isPinned }.thenByDescending { it.occurredAt })
  }

  fun newEntry() {
    if (creating) return
    creating = true
    scope.launch {
      runCatching { container.health.createDraft(localDateKey(), TimeZone.getDefault().id, System.currentTimeMillis()) }
        .onSuccess { navigator.openJournalEntry(it.id) }
      creating = false
    }
  }

  LazyColumn(
    modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().padding(horizontal = Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
    contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = Spacing.two),
  ) {
    item(key = "header") {
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Box(modifier = Modifier.weight(1f)) { SectionHeader("Journal", localDate, null) }
          Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
            RoundIcon(if (calendarVisible) Icons.Filled.Close else Icons.Filled.CalendarMonth, "Calendar") { calendarVisible = !calendarVisible; if (!calendarVisible) selectedDay = null }
            RoundIcon(if (searchVisible) Icons.Filled.Close else Icons.Filled.Search, "Search") { searchVisible = !searchVisible; if (!searchVisible) search = "" }
            RoundIcon(Icons.Filled.Add, "New entry", filled = true) { newEntry() }
          }
        }
        if (searchVisible) {
          BasicTextField(
            value = search,
            onValueChange = { search = it },
            singleLine = true,
            textStyle = BeeTheme.typography.body.copy(color = colors.text),
            cursorBrush = SolidColor(colors.text),
            modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(CircleShape).background(colors.backgroundElement).padding(horizontal = Spacing.three, vertical = Spacing.two),
            decorationBox = { inner ->
              if (search.isEmpty()) Text("Search your journal", style = BeeTheme.typography.body, color = colors.textSecondary)
              inner()
            },
          )
        }
        if (calendarVisible) {
          JournalCalendar(month, monthDays, selectedDay, onMonth = { month = it }, onDay = { selectedDay = if (selectedDay == it) null else it })
        }
      }
    }
    if (shown.isEmpty()) {
      item(key = "empty") {
        Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.five), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
          Text(if (query.isNotEmpty() || selectedDay != null) "Nothing here" else "One honest thought a day", style = BeeTheme.typography.smallBold, color = colors.text)
          Text(if (query.isNotEmpty() || selectedDay != null) "Try another day or search." else "Tap + to write your first entry.", style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center)
        }
      }
    }
    items(shown, key = { it.id }) { entry -> JournalEntryCard(entry) { navigator.openJournalEntry(entry.id) } }
  }
}

@Composable
private fun RoundIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, filled: Boolean = false, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(if (filled) colors.primary else colors.backgroundElement).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
    Icon(icon, contentDescription = label, tint = if (filled) colors.primaryForeground else colors.text, modifier = Modifier.size(18.dp))
  }
}

@Composable
fun JournalEntryCard(entry: JournalEntry, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  BeeCard(onClick = onClick, padding = 0.dp) {
    entry.coverPhoto?.let { AsyncImage(model = it.url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(140.dp)) }
    Column(modifier = Modifier.padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one), verticalAlignment = Alignment.CenterVertically) {
        Text(formatJournalDate(entry.localDate), style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.weight(1f))
        if (entry.isPinned) Icon(Icons.Filled.PushPin, contentDescription = "Pinned", tint = Hive.amber, modifier = Modifier.size(14.dp))
        if (entry.isFavorite) Icon(Icons.Filled.Star, contentDescription = "Favorite", tint = Hive.honey, modifier = Modifier.size(14.dp))
      }
      Text(entry.title.ifBlank { "Untitled" }, style = BeeTheme.typography.smallBold, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      if (entry.body.isNotBlank()) Text(entry.body, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 3, overflow = TextOverflow.Ellipsis)
      if (entry.tags.isNotEmpty()) Text(entry.tags.joinToString("  ") { "#$it" }, style = BeeTheme.typography.small, color = Hive.amber, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}

/** Month grid; days with entries get a dot, days with photos a filled one. */
@Composable
fun JournalCalendar(monthStart: String, days: List<JournalMonthDay>, selected: String?, onMonth: (String) -> Unit, onDay: (String) -> Unit) {
  val colors = BeeTheme.colors
  val first = dateFromLocalKey(monthStart)
  val byDate = days.associateBy { it.localDate }
  val leading = (first.dayOfWeek.value % 7)
  val cells = List(leading) { null } + (1..first.lengthOfMonth()).map { first.withDayOfMonth(it) }
  Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
      Text("‹", style = BeeTheme.typography.sectionTitle, color = colors.textSecondary, modifier = Modifier.clickable { onMonth(localDateKey(first.minusMonths(1))) }.padding(horizontal = Spacing.two))
      Text(DateTimeFormatter.ofPattern("MMMM yyyy").format(first), style = BeeTheme.typography.smallBold, color = colors.text)
      Text("›", style = BeeTheme.typography.sectionTitle, color = colors.textSecondary, modifier = Modifier.clickable { onMonth(localDateKey(first.plusMonths(1))) }.padding(horizontal = Spacing.two))
    }
    Row(modifier = Modifier.fillMaxWidth()) {
      for (letter in listOf("S", "M", "T", "W", "T", "F", "S")) Text(letter, style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
    }
    for (week in cells.chunked(7)) {
      Row(modifier = Modifier.fillMaxWidth()) {
        for (day in week) {
          Box(modifier = Modifier.weight(1f).height(40.dp), contentAlignment = Alignment.Center) {
            if (day != null) {
              val key = localDateKey(day)
              val info = byDate[key]
              Column(
                modifier = Modifier.size(36.dp).clip(CircleShape).background(if (selected == key) colors.secondary else Color.Transparent).clickable { onDay(key) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
              ) {
                Text(day.dayOfMonth.toString(), style = BeeTheme.typography.small, color = if (selected == key) colors.secondaryForeground else colors.text)
                if (info != null) Box(Modifier.size(5.dp).background(if (info.hasPhoto) Hive.amber else colors.textSecondary, CircleShape))
              }
            }
          }
        }
        repeat(7 - week.size) { Box(Modifier.weight(1f)) }
      }
    }
  }
}
