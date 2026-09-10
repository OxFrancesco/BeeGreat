package com.beegreat.app.profile

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.bee.cards.openUrl
import com.beegreat.app.common.HoneyQrCode
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.convex.profile.ProfileLink
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import com.clerk.api.Clerk
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private val PROVIDERS = listOf("instagram", "linkedin", "x", "github", "youtube", "tiktok", "facebook", "website")

private data class EditableLink(val id: Int, var provider: String, var label: String, var url: String)

/** Port of `public-profile.tsx`: handle, name, bio, links, publish switch, QR and share. */
@Composable
fun PublicProfileScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val colors = BeeTheme.colors
  val user by Clerk.userFlow.collectAsStateWithLifecycle()
  val profileFlow = remember { container.publicProfile.mine().map { it.getOrNull() to true } }
  val (profile, loaded) = profileFlow.collectAsStateWithLifecycle(initialValue = null to false).value
  var handle by remember { mutableStateOf("") }
  var displayName by remember { mutableStateOf("") }
  var bio by remember { mutableStateOf("") }
  var published by remember { mutableStateOf(false) }
  val links = remember { mutableStateListOf<EditableLink>() }
  var seeded by remember { mutableStateOf(false) }
  var saving by remember { mutableStateOf(false) }
  var error by remember { mutableStateOf<String?>(null) }
  var nextId by remember { mutableStateOf(0) }

  LaunchedEffect(loaded, profile?.handle) {
    if (!loaded) return@LaunchedEffect
    val current = user ?: return@LaunchedEffect
    if (profile == null) {
      val name = listOfNotNull(current.firstName, current.lastName).joinToString(" ").ifBlank { current.username ?: "Beekeeper" }
      runCatching { container.publicProfile.ensureMine(name, current.username ?: name, current.imageUrl.takeIf { current.hasImage }) }.onFailure { error = "Couldn't create your public profile." }
      return@LaunchedEffect
    }
    if (!seeded) {
      seeded = true
      handle = profile.handle
      displayName = profile.displayName
      bio = profile.bio ?: ""
      published = profile.published
      links.clear()
      profile.links.forEach { links += EditableLink(nextId++, it.provider, it.label, it.url) }
    }
  }

  fun save() {
    val current = profile ?: return
    if (links.any { it.label.isBlank() != it.url.isBlank() }) {
      error = "Each link needs both a label and an HTTPS URL."
      return
    }
    saving = true
    error = null
    scope.launch {
      runCatching {
        container.publicProfile.saveMine(
          handle.trim(),
          displayName.trim(),
          bio.trim().ifEmpty { null },
          current.avatarUrl,
          published,
          links.filter { it.label.isNotBlank() && it.url.isNotBlank() }.map { ProfileLink(it.provider, it.label.trim(), it.url.trim()) },
        )
      }.onSuccess { saved -> handle = saved.handle }.onFailure { error = it.message ?: "Couldn't save your public profile." }
      saving = false
    }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    val current = profile
    if (current == null) {
      CircularProgressIndicator(color = colors.primary, modifier = Modifier.padding(top = Spacing.six))
      return@Box
    }
    Column(
      modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = Spacing.three).padding(bottom = Spacing.five),
      verticalArrangement = Arrangement.spacedBy(Spacing.three),
    ) {
      ScreenHeader(title = "Public profile", onBack = navigator::back)
      SettingsCard {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two), modifier = Modifier.fillMaxWidth()) {
          HoneyQrCode(value = current.qrUrl, size = 184.dp)
          Text("Scan to meet your Bee", style = BeeTheme.typography.smallBold, color = colors.text)
          Text(current.profileUrl.removePrefix("https://"), style = BeeTheme.typography.small, color = colors.textSecondary, textAlign = TextAlign.Center)
          Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two)) {
            FilledButton("Share", modifier = Modifier.weight(1f)) {
              val send = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, "${current.displayName} on BeeGreat: ${current.profileUrl}") }
              context.startActivity(Intent.createChooser(send, null))
            }
            OutlineButton(if (published) "Open profile" else "Publish to open", enabled = published, modifier = Modifier.weight(1f)) { openUrl(context, current.profileUrl) }
          }
        }
      }
      SettingsCard {
        Text("Profile", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
        Field("Handle", handle, { handle = it.lowercase().replace(Regex("[^a-z0-9_-]"), "") }, prefix = "@")
        Field("Display name", displayName, { displayName = it })
        Field("Bio", bio, { bio = it }, minLines = 2)
        SettingsToggle("Publish profile", if (published) "Anyone with the link or QR can see it" else "Only you can see it until you publish", checked = published) { published = it }
      }
      SettingsCard {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
          Text("Links", style = BeeTheme.typography.smallBold, color = colors.textSecondary)
          Text("Add link", style = BeeTheme.typography.smallBold, color = colors.primary, modifier = Modifier.clickable { links += EditableLink(nextId++, "website", "", "") })
        }
        for (link in links) {
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.one), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.compact)).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(Spacing.two)) {
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.half), horizontalArrangement = Arrangement.spacedBy(Spacing.half)) {
              for (provider in PROVIDERS) {
                val selected = link.provider == provider
                Text(
                  provider,
                  style = BeeTheme.typography.small,
                  color = if (selected) colors.secondaryForeground else colors.textSecondary,
                  modifier = Modifier.clip(CircleShape).background(if (selected) colors.secondary else colors.backgroundElement).clickable { links[links.indexOf(link)] = link.copy(provider = provider) }.padding(horizontal = Spacing.one + Spacing.half, vertical = 2.dp),
                )
              }
            }
            Field("Label", link.label, { links[links.indexOf(link)] = link.copy(label = it) })
            Field("https://", link.url, { links[links.indexOf(link)] = link.copy(url = it) })
            Text("Remove", style = BeeTheme.typography.smallBold, color = colors.destructive, modifier = Modifier.clickable { links.remove(link) })
          }
        }
      }
      error?.let { Text(it, style = BeeTheme.typography.small, color = colors.destructive) }
      FilledButton(if (saving) "Saving…" else "Save profile", enabled = !saving, modifier = Modifier.fillMaxWidth()) { save() }
    }
  }
}

@Composable
private fun Field(placeholder: String, value: String, onChange: (String) -> Unit, prefix: String? = null, minLines: Int = 1) {
  val colors = BeeTheme.colors
  Row(
    modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(RoundedCornerShape(Radius.compact)).background(colors.background).border(Hairline, colors.border, RoundedCornerShape(Radius.compact)).padding(horizontal = Spacing.two + Spacing.half, vertical = Spacing.two),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(Spacing.half),
  ) {
    prefix?.let { Text(it, style = BeeTheme.typography.body, color = colors.textSecondary) }
    BasicTextField(
      value = value,
      onValueChange = onChange,
      minLines = minLines,
      singleLine = minLines == 1,
      textStyle = BeeTheme.typography.body.copy(color = colors.text),
      cursorBrush = SolidColor(colors.text),
      modifier = Modifier.weight(1f),
      decorationBox = { inner ->
        if (value.isEmpty()) Text(placeholder, style = BeeTheme.typography.body, color = colors.textSecondary)
        inner()
      },
    )
  }
}
