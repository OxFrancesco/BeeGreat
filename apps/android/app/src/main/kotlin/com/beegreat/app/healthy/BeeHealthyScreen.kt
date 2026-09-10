package com.beegreat.app.healthy

import androidx.compose.foundation.Image
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
    bottomBar = {
      NavigationBar(containerColor = colors.card) {
        for ((value, label, icon) in listOf(Triple(HealthySection.Mood, "Mood", Icons.Filled.Mood), Triple(HealthySection.Water, "Water", Icons.Filled.WaterDrop), Triple(HealthySection.Journal, "Journal", Icons.Filled.EditNote))) {
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
    Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
      when (section) {
        HealthySection.Mood -> MoodScreen(localDate, onDateChange = { localDate = it })
        HealthySection.Water -> WaterScreen(localDate, onDateChange = { localDate = it })
        HealthySection.Journal -> JournalScreen(localDate)
      }
    }
  }
}

/** Back chevron, title, and the day with previous/next controls. */
@Composable
fun SectionHeader(title: String, localDate: String, onDateChange: ((String) -> Unit)?) {
  val navigator = LocalNavigator.current
  val colors = BeeTheme.colors
  Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Back", tint = colors.text, modifier = Modifier.size(28.dp).clip(CircleShape).clickable(onClick = navigator::back))
      Text(title, style = BeeTheme.typography.barTitle, color = colors.text, modifier = Modifier.weight(1f))
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
      if (onDateChange != null) Text("‹", style = BeeTheme.typography.sectionTitle, color = colors.textSecondary, modifier = Modifier.clickable { onDateChange(shiftLocalDateKey(localDate, -1)) }.padding(horizontal = Spacing.two))
      Text(if (isTodayLocalKey(localDate)) "Today · ${formatJournalDate(localDate)}" else formatJournalDate(localDate), style = BeeTheme.typography.small, color = colors.textSecondary, modifier = Modifier.weight(1f), textAlign = if (onDateChange != null) TextAlign.Center else TextAlign.Start)
      if (onDateChange != null) Text("›", style = BeeTheme.typography.sectionTitle, color = if (isTodayLocalKey(localDate)) colors.border else colors.textSecondary, modifier = Modifier.clickable(enabled = !isTodayLocalKey(localDate)) { onDateChange(shiftLocalDateKey(localDate, 1)) }.padding(horizontal = Spacing.two))
    }
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
    verticalArrangement = Arrangement.spacedBy(Spacing.four),
  ) {
    SectionHeader("Mood", localDate, onDateChange)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.three), modifier = Modifier.fillMaxWidth()) {
      Box(modifier = Modifier.size(150.dp).clip(CircleShape).background(selected?.let { Color(it.softColor) } ?: colors.backgroundElement).border(3.dp, selected?.let { Color(it.color) } ?: colors.border, CircleShape), contentAlignment = Alignment.Center) {
        if (selected != null) Image(painterResource(moodDrawable(selected.value)), contentDescription = selected.label, modifier = Modifier.size(120.dp))
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
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
        for (option in MOODS) {
          MoodChoice(option, selected?.value == option.value, modifier = Modifier.weight(1f)) {
            scope.launch { runCatching { container.health.setMood(localDate, TimeZone.getDefault().id, option.value) }.onFailure { error = it.message } }
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
    modifier = modifier.clip(RoundedCornerShape(Radius.card)).background(if (selected) Color(option.softColor) else colors.card).border(if (selected) 2.dp else Hairline, if (selected) Color(option.color) else colors.border, RoundedCornerShape(Radius.card)).clickable(onClick = onClick).padding(vertical = Spacing.two),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(Spacing.one),
  ) {
    Image(painterResource(moodDrawable(option.value)), contentDescription = null, modifier = Modifier.size(36.dp))
    Text(option.label, style = BeeTheme.typography.small, color = colors.text, maxLines = 1)
  }
}

/** Seven columns: weekday letter, mood orb, water bar. Today is ringed in honey. */
@Composable
fun WeekPulse(throughDate: String, days: List<HealthDay>) {
  val colors = BeeTheme.colors
  val byDate = days.associateBy { it.localDate }
  val keys = (6 downTo 0).map { shiftLocalDateKey(throughDate, -it.toLong()) }
  Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three), verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
    Text("This week", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      for (key in keys) {
        val day = byDate[key]
        val mood = moodOption(day?.mood)
        val water = ((day?.hydrationMl ?: 0).toFloat() / HYDRATION_GOAL_ML).coerceIn(0f, 1f)
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
          Text(com.beegreat.contract.dateFromLocalKey(key).dayOfWeek.name.take(1), style = BeeTheme.typography.small, color = colors.textSecondary)
          Box(modifier = Modifier.size(30.dp).clip(CircleShape).background(mood?.let { Color(it.softColor) } ?: colors.backgroundElement).border(2.dp, if (isTodayLocalKey(key)) Color(0xFFE4A72C) else mood?.let { Color(it.color) } ?: colors.border, CircleShape))
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
  var lastAddition by remember { mutableStateOf<Int?>(null) }
  var error by remember { mutableStateOf<String?>(null) }
  val ratio = (current.toFloat() / HYDRATION_GOAL_ML).coerceIn(0f, 1f)

  fun add(delta: Int, showUndo: Boolean) {
    val next = (current + delta).coerceIn(0, MAX_HYDRATION_ML)
    val applied = next - current
    if (applied == 0) return
    scope.launch {
      runCatching { container.health.adjustHydration(localDate, TimeZone.getDefault().id, applied) }
        .onSuccess {
          if (showUndo && applied > 0) {
            lastAddition = applied
            delay(5000)
            if (lastAddition == applied) lastAddition = null
          }
        }
        .onFailure { error = it.message }
    }
  }

  Column(
    modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three, vertical = Spacing.two),
    verticalArrangement = Arrangement.spacedBy(Spacing.four),
  ) {
    SectionHeader("Water", localDate, onDateChange)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.three), modifier = Modifier.fillMaxWidth()) {
      Box(modifier = Modifier.size(width = 120.dp, height = 220.dp).clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp, bottomStart = 40.dp, bottomEnd = 40.dp)).background(colors.backgroundElement).border(2.dp, if (colors.isDark) Color(0xFFF1D0B0) else Color(0xFF705044), RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp, bottomStart = 40.dp, bottomEnd = 40.dp)), contentAlignment = Alignment.BottomCenter) {
        Box(modifier = Modifier.fillMaxWidth().height(220.dp * ratio).background(if (colors.isDark) Color(0xFF4BA5B2) else Color(0xFF75CBD4)))
      }
      Text("${current} / $HYDRATION_GOAL_ML ml", style = BeeTheme.typography.sectionTitle.copy(fontFeatureSettings = "tnum"), color = colors.text)
      Text(
        when {
          current >= HYDRATION_GOAL_ML -> "Daily goal reached · ${current - HYDRATION_GOAL_ML} ml extra"
          current == 0 -> "Log your first glass"
          else -> "${HYDRATION_GOAL_ML - current} ml to go"
        },
        style = BeeTheme.typography.small,
        color = colors.textSecondary,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
        WaterButton("−250", secondary = true) { add(-250, false) }
        WaterButton("+250") { add(250, true) }
        WaterButton("+500") { add(500, true) }
      }
      lastAddition?.let { added ->
        Row(modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(14.dp)).background(colors.backgroundElement).padding(horizontal = Spacing.three), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
          Text("Added $added ml", style = BeeTheme.typography.small, color = colors.text)
          Text("Undo", style = BeeTheme.typography.smallBold, color = colors.primary, modifier = Modifier.clickable { lastAddition = null; add(-added, false) })
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
        Text("Set up a reusable NFC action for your bottle or glass", style = BeeTheme.typography.small, color = colors.textSecondary)
      }
      Text("›", style = BeeTheme.typography.body, color = colors.textSecondary)
    }
  }
}

@Composable
private fun WaterButton(label: String, secondary: Boolean = false, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier = Modifier.heightIn(min = 48.dp).widthIn(min = 88.dp).clip(CircleShape).background(if (secondary) colors.card else WATER).border(Hairline, if (secondary) colors.border else Color.Transparent, CircleShape).clickable(onClick = onClick).padding(horizontal = Spacing.three),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.smallBold.copy(fontFeatureSettings = "tnum"), color = if (secondary) colors.text else Color.White)
  }
}
