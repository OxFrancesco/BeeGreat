package com.beegreat.app.healthy

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.foundation.selection.selectable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.R
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.HYDRATION_GOAL_ML
import com.beegreat.contract.MAX_HYDRATION_ML
import com.beegreat.contract.MOODS
import com.beegreat.contract.MoodOption
import com.beegreat.contract.formatJournalDate
import com.beegreat.contract.isTodayLocalKey
import com.beegreat.contract.localDateKey
import com.beegreat.contract.moodOption
import com.beegreat.contract.shiftLocalDateKey
import com.beegreat.convex.health.HealthDay
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import java.util.TimeZone
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

enum class HealthySection {
  Mood,
  Water,
  Journal,
  Streaks,
}

private val WATER = Color(0xFF55BEE2)

/**
 * Section takeover from `bee-healthy/_layout.tsx`: pushes over the main tabs
 * and mounts its own Mood, Water, Journal bar. Each screen shows the compact
 * section header with back, title, and date.
 */
@Composable
fun BeeHealthyScreen(initial: HealthySection = HealthySection.Mood) {
  val colors = BeeTheme.colors
  var section by rememberSaveable { mutableStateOf(initial) }
  var localDate by rememberSaveable { mutableStateOf(localDateKey()) }
  val tint = if (colors.isDark) Hive.honey else Hive.cacao
  Scaffold(
    containerColor = colors.background,
    contentWindowInsets = WindowInsets(0, 0, 0, 0),
    bottomBar = {
      NavigationBar(containerColor = colors.card) {
        for ((value, label, icon) in listOf(Triple(HealthySection.Mood, "Mood", Icons.Filled.Mood), Triple(HealthySection.Water, "Water", Icons.Filled.WaterDrop), Triple(HealthySection.Journal, "Journal", Icons.Filled.EditNote), Triple(HealthySection.Streaks, "Streaks", Icons.Filled.LocalFireDepartment))) {
          NavigationBarItem(
            selected = section == value,
            onClick = { section = value },
            icon = { Icon(icon, contentDescription = null) },
            label = { Text(label) },
            colors = NavigationBarItemDefaults.colors(selectedIconColor = tint, selectedTextColor = tint, indicatorColor = colors.secondary, unselectedIconColor = colors.textSecondary, unselectedTextColor = colors.textSecondary),
          )
        }
      }
    },
  ) { padding ->
    Box(modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding), contentAlignment = Alignment.TopCenter) {
      when (section) {
        HealthySection.Mood -> MoodScreen(localDate, onDateChange = { localDate = it })
        HealthySection.Water -> WaterScreen(localDate, onDateChange = { localDate = it })
        HealthySection.Journal -> JournalScreen(localDate)
        HealthySection.Streaks -> Column(Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
          SectionHeader("Streaks", localDate, onDateChange = null, showDate = false)
          HealthStreaks(localDate)
        }
      }
    }
  }
}

/** Back chevron, title, and the day with previous/next controls. */
@Composable
fun SectionHeader(title: String, localDate: String, onDateChange: ((String) -> Unit)?, showDate: Boolean = true) {
  val navigator = LocalNavigator.current
  val colors = BeeTheme.colors
  Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
    IconButton(onClick = navigator::back) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Back", tint = colors.text) }
    Text(title, style = BeeTheme.typography.barTitle, color = colors.text, modifier = Modifier.weight(1f))
    if (onDateChange != null) IconButton(onClick = { onDateChange(shiftLocalDateKey(localDate, -1)) }) { Text("‹", color = colors.text) }
    if (showDate) Text(java.time.LocalDate.parse(localDate).format(java.time.format.DateTimeFormatter.ofPattern("MMM d")), style = BeeTheme.typography.small, color = colors.textSecondary)
    if (onDateChange != null) IconButton(enabled = !isTodayLocalKey(localDate), onClick = { onDateChange(shiftLocalDateKey(localDate, 1)) }) { Text("›", color = if (isTodayLocalKey(localDate)) colors.border else colors.text) }
  }
}

private fun moodDrawable(mood: String): Int =
  when (mood) {
    "awful" -> R.drawable.bee_awful
    "bad" -> R.drawable.bee_bad
    "okay" -> R.drawable.bee_okay
    "good" -> R.drawable.bee_good
    else -> R.drawable.bee_great
  }

@Composable
fun MoodScreen(localDate: String, onDateChange: (String) -> Unit) {
  val container = LocalAppContainer.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val dayFlow = remember(localDate) { container.health.day(localDate).map { it.getOrNull() to true } }
  val (day, loaded) = dayFlow.collectAsStateWithLifecycle(initialValue = null to false).value
  val weekFlow = remember(localDate) { container.health.recentDays(localDate, 7).map { it.getOrNull() ?: emptyList() } }
  val week by weekFlow.collectAsStateWithLifecycle(initialValue = emptyList())
  var error by remember { mutableStateOf<String?>(null) }
  val selected = moodOption(day?.mood)

  Column(
    modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three, vertical = Spacing.two),
    verticalArrangement = Arrangement.spacedBy(Spacing.three),
  ) {
    SectionHeader("Mood", localDate, onDateChange)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.three), modifier = Modifier.fillMaxWidth()) {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.three)) {
      Box(modifier = Modifier.size(82.dp).clip(CircleShape).background(selected?.let { Color(it.softColor) } ?: colors.backgroundElement).border(3.dp, selected?.let { Color(it.color) } ?: colors.border, CircleShape), contentAlignment = Alignment.Center) {
        if (selected != null) Image(painterResource(moodDrawable(selected.value)), contentDescription = selected.label, modifier = Modifier.size(72.dp))
        else Icon(Icons.Filled.Mood, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(56.dp))
      }
      Text(
        when {
          !loaded -> "Loading…"
          selected != null -> "Feeling ${selected.label.lowercase()}"
          else -> "How are you feeling?"
        },
        style = BeeTheme.typography.sectionTitle,
        color = colors.text,
      )
      }
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
        for (option in MOODS) {
          MoodChoice(option, selected?.value == option.value, modifier = Modifier.weight(1f)) {
            scope.launch { error = null; runCatching { container.health.setMood(localDate, TimeZone.getDefault().id, option.value) }.onFailure { error = "Could not save your mood. Try again." } }
          }
        }
      }
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    }
    WeekPulse(localDate, week)
  }
}

@Composable
private fun MoodChoice(option: MoodOption, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Column(
    modifier = modifier.clip(RoundedCornerShape(Radius.card)).background(if (selected) Color(option.softColor) else colors.card).border(if (selected) 2.dp else Hairline, if (selected) Color(option.color) else colors.border, RoundedCornerShape(Radius.card)).selectable(selected = selected, role = Role.RadioButton, onClick = onClick).padding(vertical = Spacing.two),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(Spacing.one),
  ) {
    Image(painterResource(moodDrawable(option.value)), contentDescription = null, modifier = Modifier.size(36.dp))
    Text(option.label, style = BeeTheme.typography.small, color = if (selected) Color(0xFF202020) else colors.text, maxLines = 1)
  }
}

/** Seven columns: weekday letter, mood orb, water bar. Today is ringed in honey. */
@Composable
fun WeekPulse(throughDate: String, days: List<HealthDay>) {
  val colors = BeeTheme.colors
  val byDate = days.associateBy { it.localDate }
  val keys = (6 downTo 0).map { shiftLocalDateKey(throughDate, -it.toLong()) }
  Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Text("Mood & water · last 7 days", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      for (key in keys) {
        val day = byDate[key]
        val mood = moodOption(day?.mood)
        val water = ((day?.hydrationMl ?: 0).toFloat() / HYDRATION_GOAL_ML).coerceIn(0f, 1f)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
          Text(com.beegreat.contract.dateFromLocalKey(key).dayOfWeek.name.take(1), style = BeeTheme.typography.small, color = colors.textSecondary)
          Box(modifier = Modifier.size(24.dp).clip(CircleShape).background(mood?.let { Color(it.softColor) } ?: colors.backgroundElement).border(2.dp, if (isTodayLocalKey(key)) Color(0xFFE4A72C) else mood?.let { Color(it.color) } ?: colors.border, CircleShape))
          Box(modifier = Modifier.height(24.dp).size(6.dp, 24.dp).clip(CircleShape).background(colors.backgroundElement), contentAlignment = Alignment.BottomCenter) {
            Box(modifier = Modifier.fillMaxWidth().height(24.dp * water).background(WATER))
          }
        }
      }
    }
  }
}

@Composable
fun WaterScreen(localDate: String, onDateChange: (String) -> Unit) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val dayFlow = remember(localDate) { container.health.day(localDate).map { it.getOrNull() } }
  val day by dayFlow.collectAsStateWithLifecycle(initialValue = null)
  val current = day?.hydrationMl ?: 0
  var lastAddition by remember(localDate) { mutableStateOf<Int?>(null) }
  var saving by remember(localDate) { mutableStateOf(false) }
  var undoVersion by remember(localDate) { mutableStateOf(0) }
  var error by remember { mutableStateOf<String?>(null) }
  val ratio = (current.toFloat() / HYDRATION_GOAL_ML).coerceIn(0f, 1f)

  fun add(delta: Int, showUndo: Boolean) {
    if (saving) return
    val next = (current + delta).coerceIn(0, MAX_HYDRATION_ML)
    val applied = next - current
    if (applied == 0) return
    saving = true
    error = null
    scope.launch {
      runCatching { container.health.adjustHydration(localDate, TimeZone.getDefault().id, applied) }
        .onSuccess { result ->
          saving = false
          if (showUndo && result.appliedDeltaMl > 0) {
            lastAddition = result.appliedDeltaMl
            val version = ++undoVersion
            delay(5000)
            if (undoVersion == version) lastAddition = null
          }
        }
        .onFailure { saving = false; error = "Could not save water. Try again." }
    }
  }

  Column(
    modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three, vertical = Spacing.two),
    verticalArrangement = Arrangement.spacedBy(Spacing.three),
  ) {
    SectionHeader("Water", localDate, onDateChange)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.three), modifier = Modifier.fillMaxWidth()) {
      Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.three)) {
        WaterBottle(current.toDouble(), Modifier.weight(.85f))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
          Text("$current ml", style = BeeTheme.typography.sectionTitle.copy(fontFeatureSettings = "tnum"), color = colors.text)
          Text("of $HYDRATION_GOAL_ML ml", style = BeeTheme.typography.small, color = colors.textSecondary)
          LinearProgressIndicator(progress = { ratio }, modifier = Modifier.fillMaxWidth().height(6.dp), color = WATER, trackColor = colors.backgroundElement)
          Text(if (current >= HYDRATION_GOAL_ML) "Goal reached" else "${HYDRATION_GOAL_ML - current} ml to go", style = BeeTheme.typography.smallBold, color = colors.text)
          if (current > HYDRATION_GOAL_ML) Text("${current - HYDRATION_GOAL_ML} ml extra", style = BeeTheme.typography.small, color = colors.textSecondary)
        }
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
        WaterButton("−250", secondary = true, enabled = !saving && current > 0, modifier = Modifier.weight(1f)) { add(-250, false) }
        WaterButton("+250", enabled = !saving && current < MAX_HYDRATION_ML, modifier = Modifier.weight(1f)) { add(250, true) }
        WaterButton("+500", secondary = true, enabled = !saving && current < MAX_HYDRATION_ML, modifier = Modifier.weight(1f)) { add(500, true) }
      }
      lastAddition?.let { added ->
        Row(modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(14.dp)).background(colors.backgroundElement).padding(horizontal = Spacing.three), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
          Text("Added $added ml", style = BeeTheme.typography.small, color = colors.text)
          Text("Undo", style = BeeTheme.typography.smallBold, color = colors.primary, modifier = Modifier.heightIn(min = 44.dp).clickable(enabled = !saving) { lastAddition = null; undoVersion++; add(-added, false) }.padding(vertical = 12.dp))
        }
      }
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
    }
    Row(
      modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).clickable { navigator.openNfcActions() }.padding(Spacing.three),
      horizontalArrangement = Arrangement.spacedBy(Spacing.two),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(Icons.Filled.WaterDrop, contentDescription = null, tint = WATER, modifier = Modifier.size(22.dp))
      Column(modifier = Modifier.weight(1f)) {
        Text("Tap to log water", style = BeeTheme.typography.smallBold, color = colors.text)
        Text("Bottle and glass NFC actions", style = BeeTheme.typography.small, color = colors.textSecondary)
      }
      Text("›", style = BeeTheme.typography.body, color = colors.textSecondary)
    }
  }
}

@Composable
private fun WaterButton(label: String, secondary: Boolean = false, enabled: Boolean = true, modifier: Modifier = Modifier, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier = modifier.heightIn(min = 48.dp).clip(CircleShape).background(if (secondary) colors.card else WATER).border(Hairline, if (secondary) colors.border else Color.Transparent, CircleShape).clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = Spacing.two),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold.copy(fontFeatureSettings = "tnum"), color = if (!enabled) colors.textSecondary else if (secondary) colors.text else Color(0xFF082A35))
  }
}
