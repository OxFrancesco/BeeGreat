package com.beegreat.app.goals

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ActionSheet
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.common.SheetAction
import com.beegreat.app.common.TextPromptDialog
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.goals.GoalDetail
import com.beegreat.convex.goals.ProjectSummary
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Spacing
import com.beegreat.design.components.AddRow
import com.beegreat.design.components.BeeRowCard
import com.beegreat.design.components.CombCell
import com.beegreat.design.components.ScreenHeader
import com.beegreat.design.components.SectionLabel
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private sealed interface GoalDialog {
  data class GoalActions(val goal: GoalDetail) : GoalDialog

  data class RenameGoal(val goal: GoalDetail) : GoalDialog

  data class DeleteGoal(val goal: GoalDetail) : GoalDialog

  data class ProjectActions(val project: ProjectSummary) : GoalDialog

  data class RenameProject(val project: ProjectSummary) : GoalDialog

  data class DeleteProject(val project: ProjectSummary) : GoalDialog
}

/** Port of `(tabs)/goals/[goalId].tsx`. */
@Composable
fun GoalDetailScreen(goalId: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val goalFlow = remember(goalId) { container.goals.goal(goalId).map { it.getOrNull() to true } }
  val (goal, loaded) = goalFlow.collectAsStateWithLifecycle(initialValue = null to false).value
  var dialog by remember { mutableStateOf<GoalDialog?>(null) }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    when {
      !loaded -> CircularProgressIndicator(color = colors.primary, modifier = Modifier.padding(top = Spacing.six))
      goal == null -> Text("This goal is gone.", style = BeeTheme.typography.body, color = colors.textSecondary, modifier = Modifier.padding(Spacing.six))
      else ->
        Column(
          modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
          verticalArrangement = Arrangement.spacedBy(Spacing.three),
        ) {
          ScreenHeader(title = goal.title, onBack = navigator::back) {
            IconButton(onClick = { dialog = GoalDialog.GoalActions(goal) }) {
              Icon(Icons.Filled.Settings, contentDescription = "Goal settings", tint = colors.textSecondary, modifier = Modifier.size(20.dp))
            }
          }
          goal.finalGoal?.let { Text(it, style = BeeTheme.typography.body, color = colors.textSecondary) }
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
            SectionLabel("PROJECTS")
            for (project in goal.projects) {
              BeeRowCard(onClick = { navigator.openProject(project.id) }, onLongClick = { dialog = GoalDialog.ProjectActions(project) }) {
                CombCell(size = 44.dp, progress = project.progress)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
                  Text(project.title, style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                  Text(
                    if (project.totalTasks == 0) "No tasks yet" else "${project.doneTasks} of ${project.totalTasks} tasks done",
                    style = BeeTheme.typography.small,
                    color = colors.textSecondary,
                  )
                }
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(14.dp))
              }
            }
            AddRow(
              label = "New project",
              onSubmit = { title -> scope.launch { runCatching { container.projects.create(goal.id, title) } } },
              dashed = goal.projects.isEmpty(),
            )
          }
        }
    }
  }

  when (val current = dialog) {
    null -> Unit
    is GoalDialog.GoalActions ->
      ActionSheet(
        title = current.goal.title,
        actions =
          listOf(
            SheetAction("Rename") { dialog = GoalDialog.RenameGoal(current.goal) },
            SheetAction("Delete", destructive = true) { dialog = GoalDialog.DeleteGoal(current.goal) },
          ),
        onDismiss = { dialog = null },
      )
    is GoalDialog.RenameGoal ->
      TextPromptDialog("Rename goal", current.goal.title, onDismiss = { dialog = null }) { title ->
        scope.launch { runCatching { container.goals.rename(current.goal.id, title) } }
      }
    is GoalDialog.DeleteGoal ->
      ConfirmDialog(
        "Delete goal?",
        "\"${current.goal.title}\" and all of its projects and tasks will be gone for good.",
        "Delete",
        onDismiss = { dialog = null },
      ) {
        scope.launch {
          runCatching { container.goals.remove(current.goal.id) }
          navigator.back()
        }
      }
    is GoalDialog.ProjectActions ->
      ActionSheet(
        title = current.project.title,
        actions =
          listOf(
            SheetAction("Rename") { dialog = GoalDialog.RenameProject(current.project) },
            SheetAction("Delete", destructive = true) { dialog = GoalDialog.DeleteProject(current.project) },
          ),
        onDismiss = { dialog = null },
      )
    is GoalDialog.RenameProject ->
      TextPromptDialog("Rename project", current.project.title, onDismiss = { dialog = null }) { title ->
        scope.launch { runCatching { container.projects.rename(current.project.id, title) } }
      }
    is GoalDialog.DeleteProject ->
      ConfirmDialog(
        "Delete project?",
        "\"${current.project.title}\" and all of its tasks will be gone for good.",
        "Delete",
        onDismiss = { dialog = null },
      ) {
        scope.launch { runCatching { container.projects.remove(current.project.id) } }
      }
  }
}
