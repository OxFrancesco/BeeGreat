package com.beegreat.app.hive

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Hexagon
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.TrackChanges
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.bee.cards.formatHighlightExpiry
import com.beegreat.app.common.FloatingBee
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.focus.Achievement
import com.beegreat.convex.focus.ActiveGoal
import com.beegreat.convex.focus.CompleteHighlightResult
import com.beegreat.convex.focus.CurrentHive
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Motion
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import com.beegreat.design.hexagonPath
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

const val MVP_HONEY_CAPACITY = 100.0

private data class Completion(val result: CompleteHighlightResult, val goal: ActiveGoal?, val highlightTitle: String)

/** Port of `(tabs)/hive.tsx`: honey vessel, the current Highlight, and the badge case. */
@Composable
fun HiveScreen() {
  val container = LocalAppContainer.current
  val colors = BeeTheme.colors
  val flow = remember { container.firstFocus.current().map { it.getOrNull() } }
  val current by flow.collectAsStateWithLifecycle(initialValue = null)
  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        ScreenHeader(title = "Hive")
        CurrencyBar()
      }
      val hive = current
      if (hive == null) {
        Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) }
      } else {
        HiveDashboard(hive)
      }
    }
  }
}

@Composable
private fun HiveDashboard(current: CurrentHive) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  var completion by remember { mutableStateOf<Completion?>(null) }
  var completing by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  val highlight = current.activeHighlight
  val highlightedGoal = highlight?.let { h -> current.activeGoals.firstOrNull { it.goalId == h.goalId } }

  Column(verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
    HoneyVessel(balance = current.hive.honeyBalance)
    completion?.let { done ->
      AnimatedVisibility(visible = true, enter = fadeIn(Motion.enterSpec()) + slideInVertically(Motion.progressSpec()) { it / 4 }) {
        Row(
          modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
          horizontalArrangement = Arrangement.spacedBy(Spacing.two),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = Color(0xFFD78A00), modifier = Modifier.size(28.dp))
          Column(modifier = Modifier.weight(1f)) {
            Text(done.goal?.let { "${it.title} moved forward" } ?: "${done.highlightTitle} is complete", style = BeeTheme.typography.smallBold, color = colors.text)
            Text("+${formatCount(done.result.honeyAwarded)} Honey · +${formatCount(done.result.scoreAwarded)} Honeycomb Score", style = BeeTheme.typography.small, color = colors.textSecondary)
          }
        }
      }
    }
    if (highlight != null) {
      Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.secondary).padding(Spacing.three),
        verticalArrangement = Arrangement.spacedBy(Spacing.three),
      ) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
            Text("Highlight · until ${formatHighlightExpiry(highlight.expiresAt)}", style = BeeTheme.typography.small, color = colors.secondaryForeground)
            Text(highlight.title, style = BeeTheme.typography.sectionTitle, color = colors.secondaryForeground)
            highlightedGoal?.let { Text("For ${it.title}", style = BeeTheme.typography.small, color = colors.secondaryForeground) }
          }
          FloatingBee(height = 64.dp)
        }
        error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
        Row(
          modifier =
            Modifier.fillMaxWidth()
              .heightIn(min = 48.dp)
              .clip(CircleShape)
              .background(colors.primary)
              .alpha(if (completing) 0.6f else 1f)
              .clickable(enabled = !completing) {
                completing = true
                error = null
                scope.launch {
                  try {
                    val result = container.firstFocus.completeHighlight("complete-highlight:${highlight.highlightId}", highlight.taskId)
                    completion = Completion(result, highlightedGoal, highlight.title)
                  } catch (e: Exception) {
                    error = e.message ?: "This Highlight could not be completed."
                  } finally {
                    completing = false
                  }
                }
              },
          horizontalArrangement = Arrangement.Center,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(Icons.Filled.Check, contentDescription = null, tint = colors.primaryForeground, modifier = Modifier.size(17.dp))
          Text(if (completing) "  Completing…" else "  Complete Highlight", style = BeeTheme.typography.smallBold, color = colors.primaryForeground)
        }
      }
    } else {
      Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.four),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.two),
      ) {
        Box(modifier = Modifier.size(48.dp).background(colors.backgroundElement, CircleShape), contentAlignment = Alignment.Center) {
          Icon(Icons.Filled.TrackChanges, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(24.dp))
        }
        Text(if (current.activeGoals.isNotEmpty()) "No Highlight right now" else "Your Hive is waiting", style = BeeTheme.typography.smallBold, color = colors.text)
        Text(
          if (current.activeGoals.isNotEmpty()) "Ask Bee what to focus on next and a Highlight will land here." else "Tell Bee about a goal and it will set up your first focus.",
          style = BeeTheme.typography.small,
          color = colors.textSecondary,
          textAlign = TextAlign.Center,
        )
        Box(modifier = Modifier.heightIn(min = 44.dp).clip(CircleShape).background(colors.primary).clickable { navigator.openBee() }.padding(horizontal = Spacing.four), contentAlignment = Alignment.Center) {
          Text("Talk to Bee", style = BeeTheme.typography.smallBold, color = colors.primaryForeground)
        }
      }
    }
    EconomyStrip(current)
    HiveAchievements(current.economy.achievements)
  }
}

@Composable
private fun EconomyStrip(current: CurrentHive) {
  val colors = BeeTheme.colors
  val economy = current.economy
  val notes = buildList {
    if (economy.brainFatigue.isActive) add("Brain Fatigue drains ${formatCount(economy.brainFatigue.dailyHoneyDrain)} Honey a day across ${economy.brainFatigue.affectedGoalCount.toInt()} goals")
    if (economy.geniusState.isActive) add("Genius State: every goal is buzzing")
    economy.activeFocusShield?.let { add("Focus Shield on ${it.goalTitle} until ${formatHighlightExpiry(it.expiresAt)}") }
    economy.weeklyProgress?.let { add("This week: ${it.completedGoals.toInt()} of ${it.requiredGoals.toInt()} goals moved") }
  }
  if (notes.isEmpty()) return
  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.one),
  ) {
    for (note in notes) Text(note, style = BeeTheme.typography.small, color = colors.textSecondary)
  }
}

private data class Tier(val fill: Color, val stroke: Color, val icon: Color)

private val TIERS =
  mapOf(
    "comb" to Tier(Color(0xFFFFDFB5), Color(0xFFE5A857), Color(0xFF482401)),
    "honey" to Tier(Color(0xFFFAB52A), Color(0xFFD88909), Color(0xFF482401)),
    "gold" to Tier(Color(0xFFD88909), Color(0xFFA86400), Color(0xFFFFF3DC)),
  )

private data class Badge(val id: String, val title: String, val caption: String, val icon: ImageVector, val tier: String, val secret: Boolean = false, val isUnlocked: (List<Achievement>) -> Boolean)

private fun taskRank(rank: Double): (List<Achievement>) -> Boolean = { unlocks -> unlocks.any { it.id.contains(":tasks:") && it.rank == rank } }

private val BADGES =
  listOf(
    Badge("tasks-1", "Busy Bee", "First task done", Icons.Filled.Check, "comb", isUnlocked = taskRank(1.0)),
    Badge("tasks-5", "Worker Bee", "5 tasks on one Goal", Icons.Filled.Bolt, "honey", isUnlocked = taskRank(5.0)),
    Badge("tasks-25", "Queen's Guard", "25 tasks on one Goal", Icons.Filled.Shield, "gold", isUnlocked = taskRank(25.0)),
    Badge("goals-1", "First Harvest", "Complete a Goal", Icons.Filled.Eco, "comb") { unlocks -> unlocks.any { it.id == "hive:completed-goals:1" } },
    Badge("goals-2", "Full Comb", "Complete 2 Goals", Icons.Filled.Hexagon, "honey") { unlocks -> unlocks.any { it.id == "hive:completed-goals:2" } },
    Badge("goals-3", "Golden Hive", "Complete 3 Goals", Icons.Filled.WorkspacePremium, "gold") { unlocks -> unlocks.any { it.id == "hive:completed-goals:3" } },
    Badge("genius", "Genius Swarm", "Every Goal buzzing at once", Icons.Filled.AutoAwesome, "gold", secret = true) { unlocks -> unlocks.any { it.id == "hive:first-genius" } },
  )

/** Game-style badge case: every badge in the Hive, earned or still waiting. */
@Composable
fun HiveAchievements(achievements: List<Achievement>) {
  val colors = BeeTheme.colors
  val unlockedCount = BADGES.count { it.isUnlocked(achievements) }
  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, colors.border, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.three),
  ) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      Text("Achievements", style = BeeTheme.typography.smallBold, color = colors.text)
      Text("$unlockedCount/${BADGES.size}", style = BeeTheme.typography.small.copy(fontFeatureSettings = "tnum"), color = colors.textSecondary)
    }
    val rows = BADGES.chunked(3)
    for (row in rows) {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
        for (badge in row) {
          val unlocked = badge.isUnlocked(achievements)
          val tier = TIERS.getValue(badge.tier)
          Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
            Box(modifier = Modifier.size(64.dp), contentAlignment = Alignment.Center) {
              Canvas(modifier = Modifier.fillMaxSize().alpha(if (unlocked) 1f else 0.35f)) {
                val path = hexagonPath(this.size.minDimension, 1.5f * density, this.size.minDimension * 0.12f)
                drawPath(path, if (unlocked) tier.fill else colors.backgroundElement)
                drawPath(path, if (unlocked) tier.stroke else colors.border, style = Stroke(2f * density))
              }
              Icon(
                if (unlocked || !badge.secret) badge.icon else Icons.Filled.Lock,
                contentDescription = null,
                tint = if (unlocked) tier.icon else colors.textSecondary,
                modifier = Modifier.size(24.dp).alpha(if (unlocked) 1f else 0.6f),
              )
            }
            Text(if (badge.secret && !unlocked) "???" else badge.title, style = BeeTheme.typography.smallBold, color = if (unlocked) colors.text else colors.textSecondary, textAlign = TextAlign.Center)
            Text(if (badge.secret && !unlocked) "Keep going" else badge.caption, style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center)
          }
        }
        repeat(3 - row.size) { Box(Modifier.weight(1f)) }
      }
    }
  }
}
