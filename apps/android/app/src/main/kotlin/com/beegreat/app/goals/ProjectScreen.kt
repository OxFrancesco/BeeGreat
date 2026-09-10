package com.beegreat.app.goals

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.ActionSheet
import com.beegreat.app.common.ConfirmDialog
import com.beegreat.app.common.SheetAction
import com.beegreat.app.common.TextPromptDialog
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.projects.ProjectDetail
import com.beegreat.convex.projects.ProjectDue
import com.beegreat.convex.tasks.Task
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Motion
import com.beegreat.design.Spacing
import com.beegreat.design.components.AddRow
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import com.beegreat.design.components.SectionLabel
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** End of the given day in local time, as epoch millis. */
private fun endOfDayIn(days: Long): Long =
  LocalDate.now().plusDays(days).atTime(LocalTime.of(23, 59, 59, 999_000_000)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

private fun formatDueDate(dueDate: Long): String = DateTimeFormatter.ofPattern("MMM d").format(Instant.ofEpochMilli(dueDate).atZone(ZoneId.systemDefault()))

/** The next four quarters starting from the current one. */
private fun upcomingQuarters(): List<ProjectDue> {
  val now = LocalDate.now()
  var year = now.year
  var quarter = (now.monthValue - 1) / 3 + 1
  return List(4) {
    val entry = ProjectDue(year, quarter)
    quarter += 1
    if (quarter > 4) {
      quarter = 1
      year += 1
    }
    entry
  }
}

private data class TaskTree(val open: List<Pair<Task, List<Task>>>, val done: List<Pair<Task, List<Task>>>)

/** Groups a flat task list into parent tasks with their subtasks. */
private fun buildTree(tasks: List<Task>): TaskTree {
  val byParent = tasks.filter { it.parentTaskId != null }.groupBy { it.parentTaskId!! }
  val parents = tasks.filter { it.parentTaskId == null }.map { it to (byParent[it.id] ?: emptyList()) }
  return TaskTree(open = parents.filter { !it.first.done }, done = parents.filter { it.first.done })
}

private sealed interface ProjectDialog {
  data class TaskActions(val task: Task) : ProjectDialog

  data class RenameTask(val task: Task) : ProjectDialog

  data class DueDate(val task: Task) : ProjectDialog

  data class DeleteTask(val task: Task) : ProjectDialog

  data class Settings(val project: ProjectDetail) : ProjectDialog

  data class RenameProject(val project: ProjectDetail) : ProjectDialog

  data class DeleteProject(val project: ProjectDetail) : ProjectDialog

  data class Target(val project: ProjectDetail) : ProjectDialog
}

/** Port of `(tabs)/goals/project/[projectId].tsx`. */
@Composable
fun ProjectScreen(projectId: String) {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val stateFlow =
    remember(projectId) {
      combine(container.projects.project(projectId), container.tasks.listByProject(projectId), container.firstFocus.current()) { project, tasks, focus ->
        Triple(project.getOrNull(), tasks.getOrNull() ?: emptyList(), focus.getOrNull()?.activeHighlight?.taskId)
      }
    }
  val loadedState by stateFlow.collectAsStateWithLifecycle(initialValue = null)
  var dialog by remember { mutableStateOf<ProjectDialog?>(null) }
  var subtaskTarget by remember { mutableStateOf<String?>(null) }

  fun run(block: suspend () -> Unit) {
    scope.launch { runCatching { block() } }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    val state = loadedState
    when {
      state == null -> CircularProgressIndicator(color = colors.primary, modifier = Modifier.padding(top = Spacing.six))
      state.first == null -> Text("This project is gone.", style = BeeTheme.typography.body, color = colors.textSecondary, modifier = Modifier.padding(Spacing.six))
      else -> {
        val project = state.first!!
        val tree = remember(state.second) { buildTree(state.second) }
        val highlightTaskId = state.third
        Column(
          modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
          verticalArrangement = Arrangement.spacedBy(Spacing.two),
        ) {
          ScreenHeader(title = project.title, onBack = navigator::back) {
            IconButton(onClick = { dialog = ProjectDialog.Settings(project) }) {
              Icon(Icons.Filled.Settings, contentDescription = "Project settings", tint = colors.textSecondary, modifier = Modifier.size(20.dp))
            }
          }
          Row(
            modifier = Modifier.heightIn(min = 36.dp).clip(CircleShape).background(colors.backgroundElement).combinedClickable(onClick = { dialog = ProjectDialog.Target(project) }).padding(horizontal = Spacing.two + Spacing.half),
            horizontalArrangement = Arrangement.spacedBy(Spacing.one),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(14.dp))
            Text(
              project.due?.let { "Target: ${it.label}" } ?: "Set a target date (quarter or year)",
              style = BeeTheme.typography.small,
              color = colors.textSecondary,
            )
          }
          for ((task, subtasks) in tree.open) {
            TaskRow(task, highlighted = task.id == highlightTaskId, onToggle = { run { container.tasks.toggle(task.id) } }, onLongClick = { dialog = ProjectDialog.TaskActions(task) }, onAddSubtask = { subtaskTarget = if (subtaskTarget == task.id) null else task.id })
            for (subtask in subtasks) {
              TaskRow(subtask, highlighted = subtask.id == highlightTaskId, isSubtask = true, onToggle = { run { container.tasks.toggle(subtask.id) } }, onLongClick = { dialog = ProjectDialog.TaskActions(subtask) })
            }
            if (subtaskTarget == task.id) {
              Box(modifier = Modifier.padding(start = 30.dp)) {
                AddRow(
                  label = "New subtask",
                  onSubmit = { title ->
                    subtaskTarget = null
                    run { container.tasks.create(project.id, title, task.id) }
                  },
                  startActive = true,
                  compact = true,
                  onDismiss = { subtaskTarget = null },
                )
              }
            }
          }
          AddRow(
            label = "New task",
            onSubmit = { title -> run { container.tasks.create(project.id, title) } },
            dashed = tree.open.isEmpty() && tree.done.isEmpty(),
            modifier = Modifier.padding(top = Spacing.one),
          )
          if (tree.done.isNotEmpty()) {
            HorizontalDivider(color = colors.border, thickness = Hairline, modifier = Modifier.padding(vertical = Spacing.two))
            SectionLabel("DONE")
            for ((task, subtasks) in tree.done) {
              TaskRow(task, highlighted = task.id == highlightTaskId, onToggle = { run { container.tasks.toggle(task.id) } }, onLongClick = { dialog = ProjectDialog.TaskActions(task) })
              for (subtask in subtasks) {
                TaskRow(subtask, highlighted = subtask.id == highlightTaskId, isSubtask = true, onToggle = { run { container.tasks.toggle(subtask.id) } }, onLongClick = { dialog = ProjectDialog.TaskActions(subtask) })
              }
            }
          }
        }
      }
    }
  }

  when (val current = dialog) {
    null -> Unit
    is ProjectDialog.TaskActions ->
      ActionSheet(
        title = current.task.title,
        actions =
          listOf(
            SheetAction("Rename") { dialog = ProjectDialog.RenameTask(current.task) },
            SheetAction("Set due date…") { dialog = ProjectDialog.DueDate(current.task) },
            SheetAction("Delete task", destructive = true) { dialog = ProjectDialog.DeleteTask(current.task) },
          ),
        onDismiss = { dialog = null },
      )
    is ProjectDialog.RenameTask ->
      TextPromptDialog("Rename task", current.task.title, onDismiss = { dialog = null }) { title -> run { container.tasks.rename(current.task.id, title) } }
    is ProjectDialog.DueDate ->
      ActionSheet(
        title = "Due date",
        message = "When is \"${current.task.title}\" due?",
        actions =
          buildList {
            add(SheetAction("Today") { run { container.tasks.setDueDate(current.task.id, endOfDayIn(0)) } })
            add(SheetAction("Tomorrow") { run { container.tasks.setDueDate(current.task.id, endOfDayIn(1)) } })
            add(SheetAction("Next week") { run { container.tasks.setDueDate(current.task.id, endOfDayIn(7)) } })
            add(SheetAction("In two weeks") { run { container.tasks.setDueDate(current.task.id, endOfDayIn(14)) } })
            if (current.task.dueDate != null) add(SheetAction("Remove due date", destructive = true) { run { container.tasks.setDueDate(current.task.id, null) } })
          },
        onDismiss = { dialog = null },
      )
    is ProjectDialog.DeleteTask ->
      ConfirmDialog("Delete task?", "\"${current.task.title}\" and its subtasks will be removed.", "Delete", onDismiss = { dialog = null }) {
        run { container.tasks.remove(current.task.id) }
      }
    is ProjectDialog.Settings ->
      ActionSheet(
        title = current.project.title,
        actions =
          listOf(
            SheetAction("Rename") { dialog = ProjectDialog.RenameProject(current.project) },
            SheetAction("Delete", destructive = true) { dialog = ProjectDialog.DeleteProject(current.project) },
          ),
        onDismiss = { dialog = null },
      )
    is ProjectDialog.RenameProject ->
      TextPromptDialog("Rename project", current.project.title, onDismiss = { dialog = null }) { title -> run { container.projects.rename(current.project.id, title) } }
    is ProjectDialog.DeleteProject ->
      ConfirmDialog("Delete project?", "\"${current.project.title}\" and all of its tasks will be gone for good.", "Delete", onDismiss = { dialog = null }) {
        scope.launch {
          runCatching { container.projects.remove(current.project.id) }
          navigator.back()
        }
      }
    is ProjectDialog.Target -> {
      val thisYear = LocalDate.now().year
      ActionSheet(
        title = "Target date",
        message = "When should this project land?",
        actions =
          buildList {
            for (entry in upcomingQuarters()) add(SheetAction(entry.label) { run { container.projects.setDue(current.project.id, entry) } })
            add(SheetAction("$thisYear") { run { container.projects.setDue(current.project.id, ProjectDue(thisYear)) } })
            add(SheetAction("${thisYear + 1}") { run { container.projects.setDue(current.project.id, ProjectDue(thisYear + 1)) } })
            if (current.project.due != null) add(SheetAction("Remove target", destructive = true) { run { container.projects.setDue(current.project.id, null) } })
          },
        onDismiss = { dialog = null },
      )
    }
  }
}

/** One row of the project to-do list; subtasks render indented and smaller. */
@Composable
fun TaskRow(task: Task, highlighted: Boolean, onToggle: () -> Unit, onLongClick: () -> Unit, isSubtask: Boolean = false, onAddSubtask: (() -> Unit)? = null) {
  val colors = BeeTheme.colors
  val now = remember { System.currentTimeMillis() }
  val dueDate = task.dueDate
  val overdue = !task.done && dueDate != null && dueDate < now
  val progress by animateFloatAsState(if (task.done) 1f else 0f, Motion.enterSpec(), label = "taskDone")
  val iconSize = if (isSubtask) 18.dp else 22.dp
  Row(
    modifier =
      Modifier.fillMaxWidth()
        .heightIn(min = if (isSubtask) 40.dp else 48.dp)
        .combinedClickable(onClick = onToggle, onLongClick = onLongClick)
        .padding(start = if (isSubtask) 30.dp else 0.dp, top = Spacing.one, bottom = Spacing.one),
    horizontalArrangement = Arrangement.spacedBy(Spacing.two),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Box(modifier = Modifier.size(iconSize)) {
      Icon(Icons.Outlined.Circle, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(iconSize).graphicsLayer { alpha = 1f - progress; scaleX = 0.97f + 0.03f * (1 - progress); scaleY = scaleX })
      Icon(Icons.Filled.CheckCircle, contentDescription = null, tint = Hive.honey, modifier = Modifier.size(iconSize).graphicsLayer { alpha = progress; scaleX = 0.97f + 0.03f * progress; scaleY = scaleX })
    }
    Column(modifier = Modifier.weight(1f)) {
      Text(
        task.title,
        style = (if (isSubtask) BeeTheme.typography.small else BeeTheme.typography.body).copy(textDecoration = if (task.done) TextDecoration.LineThrough else null),
        color = if (task.done) colors.textSecondary else colors.text,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      val meta = buildList {
        dueDate?.let { add(if (overdue) "Overdue · ${formatDueDate(it)}" else "Due ${formatDueDate(it)}") }
        if (highlighted) add("Current Highlight")
        addAll(task.labels)
      }
      if (meta.isNotEmpty()) Text(meta.joinToString(" · "), style = BeeTheme.typography.small, color = if (overdue) colors.destructive else if (highlighted) Hive.amber else colors.textSecondary)
    }
    if (onAddSubtask != null && !task.done) {
      IconButton(onClick = onAddSubtask, modifier = Modifier.size(32.dp)) {
        Icon(Icons.Filled.Add, contentDescription = "Add subtask", tint = colors.textSecondary, modifier = Modifier.size(16.dp))
      }
    }
  }
}
