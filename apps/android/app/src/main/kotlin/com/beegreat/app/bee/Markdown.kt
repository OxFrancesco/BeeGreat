package com.beegreat.app.bee

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.sp
import com.beegreat.design.BeeTheme
import com.beegreat.design.Hive
import com.beegreat.design.Spacing
import com.mikepenz.markdown.coil3.Coil3ImageTransformerImpl
import com.mikepenz.markdown.m3.Markdown
import com.mikepenz.markdown.m3.markdownColor
import com.mikepenz.markdown.m3.markdownTypography
import com.mikepenz.markdown.model.markdownPadding

/**
 * Assistant markdown at 17/26 with honey-underlined links, `backgroundElement`
 * code blocks, and quiet quotes, per design-system section 9.
 */
@Composable
fun BeeMarkdown(text: String, modifier: Modifier = Modifier) {
  MarkdownBlock(text, modifier, BeeTheme.typography.chatBody)
}

/** Same rules for text inside a card body, at body size. */
@Composable
fun CardMarkdown(text: String, modifier: Modifier = Modifier) {
  MarkdownBlock(text, modifier, BeeTheme.typography.body, block = Spacing.one)
}

@Composable
private fun MarkdownBlock(text: String, modifier: Modifier, base: TextStyle, block: androidx.compose.ui.unit.Dp = Spacing.two) {
  val colors = BeeTheme.colors
  val body = base.copy(color = colors.text)
  Markdown(
    content = text,
    modifier = modifier,
    imageTransformer = Coil3ImageTransformerImpl,
    colors =
      markdownColor(
        text = colors.text,
        codeBackground = colors.backgroundElement,
        inlineCodeBackground = colors.backgroundElement,
        dividerColor = colors.border,
        tableBackground = colors.card,
      ),
    typography =
      markdownTypography(
        h1 = body.copy(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.SemiBold),
        h2 = body.copy(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
        h3 = body.copy(fontSize = 20.sp, lineHeight = 26.sp, fontWeight = FontWeight.SemiBold),
        h4 = body.copy(fontWeight = FontWeight.SemiBold),
        h5 = body.copy(fontWeight = FontWeight.SemiBold),
        h6 = body.copy(fontWeight = FontWeight.SemiBold),
        text = body,
        paragraph = body,
        ordered = body,
        bullet = body,
        list = body,
        quote = body.copy(color = colors.textSecondary, fontStyle = FontStyle.Italic),
        code = BeeTheme.typography.code.copy(fontSize = 14.sp, lineHeight = 20.sp, color = colors.text),
        inlineCode = BeeTheme.typography.code.copy(fontSize = 15.sp, color = colors.text),
        textLink = TextLinkStyles(style = SpanStyle(textDecoration = TextDecoration.Underline, color = Hive.amber)),
        table = body,
      ),
    padding = markdownPadding(block = block, list = Spacing.one, listItemTop = Spacing.half, listItemBottom = Spacing.half),
  )
}
