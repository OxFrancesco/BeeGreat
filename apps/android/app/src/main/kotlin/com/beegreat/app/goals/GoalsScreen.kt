package com.beegreat.app.goals

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.healthSummary
import com.beegreat.contract.localDateKey
import kotlinx.coroutines.flow.map
import com.beegreat.convex.goals.GoalSummary
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.AddRow
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.BeeRowCard
import com.beegreat.design.components.CombCell
import com.beegreat.design.components.ScreenHeader
import com.beegreat.design.components.SectionLabel

private const val MAX_GOALS = 3

/** Port of `apps/mobile/src/app/(tabs)/goals/index.tsx`. */
@Composable
fun GoalsScreen() {
  val container = LocalAppContainer.current
  val viewModel: GoalsViewModel = viewModel { GoalsViewModel(container.goals) }
  val state by viewModel.state.collectAsStateWithLifecycle()
  val notice by viewModel.notice.collectAsStateWithLifecycle()
  val snackbar = remember { SnackbarHostState() }
  val todayFlow = remember(container) { container.health.day(localDateKey()).map { result -> result.getOrNull().let { day -> healthSummary(day?.mood, day?.hydrationMl ?: 0) } } }
  val todaySummary by todayFlow.collectAsStateWithLifecycle(initialValue = "Loading today’s ritual…")

  LaunchedEffect(notice) {
    val message = notice ?: return@LaunchedEffect
    snackbar.showSnackbar(message)
    viewModel.dismissNotice()
  }

  Box(modifier = Modifier.fillMaxSize()) {
    GoalsScreenView(
      state = state,
      onAddGoal = viewModel::addGoal,
      onRenameGoal = viewModel::renameGoal,
      onRemoveGoal = viewModel::removeGoal,
      healthSummary = todaySummary,
    )
    SnackbarHost(hostState = snackbar, modifier = Modifier.align(Alignment.BottomCenter)) {
      Snackbar(
        snackbarData = it,
        containerColor = BeeTheme.colors.backgroundElement,
        contentColor = BeeTheme.colors.text,
        shape = RoundedCornerShape(14.dp),
      )
    }
  }
}

@Composable
fun GoalsScreenView(
  state: GoalsUiState,
  onAddGoal: (String) -> Unit,
  onRenameGoal: (goalId: String, title: String) -> Unit,
  onRemoveGoal: (goalId: String) -> Unit,
  healthSummary: String? = null,
) {
  val colors = BeeTheme.colors
  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    Column(
      modifier =
        Modifier.widthIn(max = MaxContentWidth)
          .fillMaxWidth()
          .verticalScroll(rememberScrollState())
          .imePadding()
          .padding(horizontal = Spacing.three)
          .padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        ScreenHeader(title = "Goals")
      }
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        SectionLabel("Bee Healthy")
        BeeHealthyCard(summary = healthSummary ?: "Mood, water, and one honest thought")
      }
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        SectionLabel("Reminders")
        ReminderOverviewCard()
      }
      when (state) {
        GoalsUiState.Loading ->
          Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = colors.primary)
          }
        is GoalsUiState.Failed ->
          Text(text = state.message, style = BeeTheme.typography.small, color = colors.destructive)
        is GoalsUiState.Loaded ->
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
            SectionLabel("Active goals")
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.three)) {
              state.goals.forEach { goal ->
                GoalCard(goal = goal, onRename = { onRenameGoal(goal.id, it) }, onRemove = { onRemoveGoal(goal.id) })
              }
              if (state.goals.size < MAX_GOALS) {
                AddRow(label = "New goal", onSubmit = onAddGoal, dashed = true)
              }
            }
          }
      }
    }
  }
}

@Composable
private fun BeeHealthyCard(summary: String) {
  val navigator = LocalNavigator.current
  val colors = BeeTheme.colors
  BeeRowCard(onClick = navigator::openBeeHealthy) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
      Text("Bee Healthy", style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(summary, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(14.dp))
  }
}

@Composable
private fun ReminderOverviewCard() {
  val navigator = LocalNavigator.current
  val colors = BeeTheme.colors
  BeeRowCard(onClick = navigator::openReminders) {
    Box(
      modifier = Modifier.size(44.dp).background(colors.secondary, RoundedCornerShape(Radius.tile)),
      contentAlignment = Alignment.Center,
    ) {
      Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = colors.secondaryForeground, modifier = Modifier.size(22.dp))
    }
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
      Text("NFC reminders", style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      Text(
        "Turn repeated chores into one-tap completions",
        style = BeeTheme.typography.small,
        color = colors.textSecondary,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
    }
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(14.dp))
  }
}

@Composable
private fun GoalCard(goal: GoalSummary, onRename: (String) -> Unit, onRemove: () -> Unit) {
  val colors = BeeTheme.colors
  var menuOpen by remember { mutableStateOf(false) }
  var renaming by remember { mutableStateOf(false) }
  var confirmingDelete by remember { mutableStateOf(false) }
  val meta =
    when {
      goal.totalTasks == 0 -> null
      goal.openTasks == 0 -> "All tasks done"
      goal.openTasks == 1 -> "1 task left"
      else -> "${goal.openTasks} tasks left"
    }

  val navigator = LocalNavigator.current
  BeeRowCard(onClick = { navigator.openGoal(goal.id) }, onLongClick = { menuOpen = true }) {
    CombCell(size = 52.dp, progress = goal.progress)
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
      Text(goal.title, style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
      if (meta != null) {
        Text(meta, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
    }
    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(14.dp))
  }

  if (menuOpen) {
    AlertDialog(
      onDismissRequest = { menuOpen = false },
      title = { Text(goal.title) },
      confirmButton = {
        TextButton(onClick = { menuOpen = false; renaming = true }) { Text("Rename") }
      },
      dismissButton = {
        TextButton(onClick = { menuOpen = false; confirmingDelete = true }) {
          Text("Delete", color = colors.destructive)
        }
      },
    )
  }

  if (renaming) {
    var title by remember { mutableStateOf(goal.title) }
    AlertDialog(
      onDismissRequest = { renaming = false },
      title = { Text("Rename goal") },
      text = { OutlinedTextField(value = title, onValueChange = { title = it }, singleLine = true) },
      confirmButton = {
        TextButton(
          onClick = {
            renaming = false
            if (title.isNotBlank()) onRename(title)
          }
        ) {
          Text("Save")
        }
      },
      dismissButton = { TextButton(onClick = { renaming = false }) { Text("Cancel") } },
    )
  }

  if (confirmingDelete) {
    AlertDialog(
      onDismissRequest = { confirmingDelete = false },
      title = { Text("Delete goal?") },
      text = { Text("\"${goal.title}\" and all of its projects and tasks will be gone for good.") },
      confirmButton = {
        TextButton(
          onClick = {
            confirmingDelete = false
            onRemove()
          }
        ) {
          Text("Delete", color = colors.destructive)
        }
      },
      dismissButton = { TextButton(onClick = { confirmingDelete = false }) { Text("Cancel") } },
    )
  }
}

@Preview(showBackground = true)
@Composable
private fun GoalsScreenPreview() {
  BeeTheme {
    GoalsScreenView(
      state =
        GoalsUiState.Loaded(
          listOf(
            GoalSummary(id = "g1", title = "Ship BeeGreat Android", projectCount = 2, openTasks = 4, doneTasks = 6),
            GoalSummary(id = "g2", title = "Run a half marathon", projectCount = 1, openTasks = 0, doneTasks = 3),
          )
        ),
      onAddGoal = {},
      onRenameGoal = { _, _ -> },
      onRemoveGoal = {},
    )
  }
}
