package com.beegreat.app.bee.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.contract.BeeUiComponent
import com.beegreat.contract.questionAnswer
import com.beegreat.design.BeeTheme
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.Hairline
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/** Task rows overlay live Convex state and toggle through the same mutation the Goals screens use. */
@Composable
fun TaskListCard(component: BeeUiComponent.Tasks) {
  val colors = BeeTheme.colors
  val container = LocalAppContainer.current
  val scope = rememberCoroutineScope()
  val ids = remember(component) { component.items.map { it.id } }
  val liveFlow = remember(ids) { container.tasks.statuses(ids).map { result -> result.getOrNull()?.associate { it.id to (it.status == "done") } } }
  val live by liveFlow.collectAsStateWithLifecycle(initialValue = null)
  BeeCard {
    Text(component.title, style = BeeTheme.typography.smallBold, color = colors.text)
    Column {
      for (item in component.items) {
        val done = live?.get(item.id) ?: item.done
        Row(
          modifier =
            Modifier.fillMaxWidth()
              .heightIn(min = 44.dp)
              .clickable { scope.launch { runCatching { container.tasks.toggle(item.id) } } }
              .padding(vertical = Spacing.one),
          horizontalArrangement = Arrangement.spacedBy(Spacing.two),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(
            if (done) Icons.Filled.CheckCircle else Icons.Outlined.Circle,
            contentDescription = if (done) "Done" else "To do",
            tint = if (done) colors.primary else colors.textSecondary,
            modifier = Modifier.size(22.dp),
          )
          Column(modifier = Modifier.weight(1f)) {
            Text(
              item.title,
              style = BeeTheme.typography.body.copy(textDecoration = if (done) TextDecoration.LineThrough else null),
              color = if (done) colors.textSecondary else colors.text,
            )
            item.due?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary) }
          }
        }
      }
    }
  }
}

/**
 * One quiet card of short prompts separated by hairlines. Options are 44dp
 * rows; the selected one gets the region's single honey accent; the typed
 * answer path stays explicit. A choice is sent as a normal reply.
 */
@Composable
fun QuestionCard(component: BeeUiComponent.Question, onReply: (String) -> Unit) {
  val colors = BeeTheme.colors
  val answers = remember(component) { mutableStateMapOf<Int, String>() }
  var sent by remember(component) { mutableStateOf(false) }
  var custom by remember(component) { mutableStateOf("") }
  val questions = component.questions
  val allAnswered = questions.indices.all { answers[it]?.isNotBlank() == true }

  fun send(text: String) {
    if (sent) return
    sent = true
    onReply(text)
  }

  fun choose(index: Int, prompt: String, label: String) {
    if (sent) return
    if (questions.size == 1) send(questionAnswer(prompt, label)) else answers[index] = label
  }

  BeeCard {
    questions.forEachIndexed { index, prompt ->
      if (index > 0) HorizontalDivider(color = colors.border, thickness = Hairline)
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
        Text(prompt.header, style = BeeTheme.typography.smallBold, color = colors.textSecondary)
        Text(prompt.question, style = BeeTheme.typography.body, color = colors.text)
        prompt.options?.let { options ->
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
            for (option in options) {
              val selected = answers[index] == option.label
              Column(
                modifier =
                  Modifier.fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radius.compact))
                    .background(if (selected) colors.secondary else colors.backgroundElement)
                    .clickable(enabled = !sent) { choose(index, prompt.question, option.label) }
                    .padding(horizontal = Spacing.three, vertical = Spacing.two),
                verticalArrangement = Arrangement.Center,
              ) {
                Text(option.label, style = BeeTheme.typography.smallBold, color = if (selected) colors.secondaryForeground else colors.text)
                option.description?.let { Text(it, style = BeeTheme.typography.small, color = if (selected) colors.secondaryForeground else colors.textSecondary) }
              }
            }
          }
        }
      }
    }
    if (questions.size > 1) {
      Box(
        modifier =
          Modifier.fillMaxWidth()
            .heightIn(min = 44.dp)
            .clip(CircleShape)
            .background(if (allAnswered && !sent) colors.primary else colors.backgroundElement)
            .clickable(enabled = allAnswered && !sent) {
              send(questions.indices.joinToString("\n") { questionAnswer(questions[it].question, answers[it] ?: "") })
            },
        contentAlignment = Alignment.Center,
      ) {
        Text(if (sent) "Sent" else "Send answers", style = BeeTheme.typography.smallBold, color = if (allAnswered && !sent) colors.primaryForeground else colors.textSecondary)
      }
    }
    Row(
      modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(Radius.compact)).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(horizontal = Spacing.three),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      BasicTextField(
        value = custom,
        onValueChange = { custom = it },
        enabled = !sent,
        modifier = Modifier.weight(1f),
        textStyle = BeeTheme.typography.small.copy(color = colors.text),
        cursorBrush = SolidColor(colors.text),
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
        keyboardActions = KeyboardActions(onSend = { if (custom.isNotBlank()) send(custom.trim()) }),
        decorationBox = { inner ->
          if (custom.isEmpty()) Text("Or type your own answer", style = BeeTheme.typography.small, color = colors.textSecondary)
          inner()
        },
      )
    }
  }
}

private val DEVIN_BORDER = Color(0x66F2765A)
private val DEVIN_SOLID = Color(0xFFD85238)

/** Devin cloud-task status; live-updates from Convex. The session id never reaches the user. */
@Composable
fun DevinCard(component: BeeUiComponent.Devin, onReply: (String) -> Unit) {
  val colors = BeeTheme.colors
  val context = LocalContext.current
  val container = LocalAppContainer.current
  val liveFlow = remember(component.sessionId) { container.devin.session(component.sessionId).map { it.getOrNull() } }
  val live by liveFlow.collectAsStateWithLifecycle(initialValue = null)
  val status = live?.status ?: component.status
  val detail = (live?.statusDetail ?: component.statusDetail ?: status).replace('_', ' ')
  val pullRequests = live?.pullRequests?.map { BeeUiComponent.Devin.PullRequest(it.url, it.state) } ?: component.pullRequests

  Column(
    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.card)).background(colors.card).border(Hairline, DEVIN_BORDER, RoundedCornerShape(Radius.card)).padding(Spacing.three),
    verticalArrangement = Arrangement.spacedBy(Spacing.two),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
      Box(modifier = Modifier.size(28.dp).background(DEVIN_SOLID, RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
        Icon(Icons.Filled.Cloud, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
      }
      Text(component.title, style = BeeTheme.typography.smallBold, color = colors.text, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
      Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).background(DEVIN_SOLID, CircleShape))
        Text(detail, style = BeeTheme.typography.smallBold, color = DEVIN_SOLID)
      }
    }
    component.summary?.let { Text(it, style = BeeTheme.typography.body, color = colors.text) }
    if (pullRequests.isNotEmpty()) {
      Column(verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
        Text("Pull requests", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
        pullRequests.forEachIndexed { index, pr ->
          Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 40.dp).clickable { openUrl(context, pr.url) },
            horizontalArrangement = Arrangement.spacedBy(Spacing.two),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text("Pull request ${index + 1}", style = BeeTheme.typography.smallBold, color = colors.text, modifier = Modifier.weight(1f))
            pr.state?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary) }
          }
        }
      }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
      Box(
        modifier = Modifier.weight(1f).heightIn(min = 44.dp).clip(CircleShape).background(DEVIN_SOLID).clickable { openUrl(context, component.sessionUrl) },
        contentAlignment = Alignment.Center,
      ) {
        Text("Open in Devin", style = BeeTheme.typography.smallBold, color = Color.White)
      }
      Box(
        modifier = Modifier.weight(1f).heightIn(min = 44.dp).clip(CircleShape).border(Hairline, colors.border, CircleShape).clickable { onReply("Check on the Devin task \"${component.title}\" and tell me what changed.") },
        contentAlignment = Alignment.Center,
      ) {
        Text("Ask for an update", style = BeeTheme.typography.smallBold, color = colors.text)
      }
    }
  }
}
