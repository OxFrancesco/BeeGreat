package com.beegreat.app.mind

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Hexagon
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.beegreat.app.LocalAppContainer
import com.beegreat.app.common.HexShape
import com.beegreat.app.shell.LocalNavigator
import com.beegreat.contract.bookmarkRelativeDate
import com.beegreat.contract.bookmarkSourceLabel
import com.beegreat.convex.bookmarks.Bookmark
import com.beegreat.design.BeeTheme
import com.beegreat.design.MaxContentWidth
import com.beegreat.design.Radius
import com.beegreat.design.Spacing
import com.beegreat.design.components.BeeCard
import com.beegreat.design.components.Hairline
import com.beegreat.design.components.ScreenHeader
import kotlinx.coroutines.flow.distinctUntilChanged

private val KINDS = listOf(null to "All", "website" to "Sites", "tweet" to "Tweets", "youtube" to "Videos")

/** Comb palette from `bookmark-item.tsx`. */
private object Comb {
  val fillTop = Color(0xFFFFEBC4)
  val fillBottom = Color(0xFFFCC968)
  val failedTop = Color(0xFFFBE0D6)
  val failedBottom = Color(0xFFF3B39E)
  val wall = Color(0xFFE39A2E)
  val text = Color(0xFF582D1D)
  val labelInk = Color(0xFF6D4B0D)
  val labelFill = Color(0xFFFFF0C2)
}

private fun Bookmark.sourceLabel() = bookmarkSourceLabel(url, meta?.handle, meta?.author, kind)

/** Port of `(tabs)/mind/index.tsx`: search, kind and label filters, and the list, cards, or honeycomb views. */
@Composable
fun MindScreen() {
  val container = LocalAppContainer.current
  val navigator = LocalNavigator.current
  val viewModel: MindViewModel = viewModel { MindViewModel(container.bookmarks) }
  val state by viewModel.state.collectAsStateWithLifecycle()
  val filters by viewModel.filters.collectAsStateWithLifecycle()
  val view by viewModel.view.collectAsStateWithLifecycle()
  val colors = BeeTheme.colors
  val listState = rememberLazyListState()

  LaunchedEffect(listState, state.canLoadMore, state.loadingMore) {
    snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
      .distinctUntilChanged()
      .collect { last -> if (last != null && last >= listState.layoutInfo.totalItemsCount - 3 && state.canLoadMore && !state.loadingMore) viewModel.loadMore() }
  }

  Box(modifier = Modifier.fillMaxSize().background(colors.background), contentAlignment = Alignment.TopCenter) {
    BoxWithConstraints(modifier = Modifier.widthIn(max = MaxContentWidth).fillMaxSize()) {
      val contentWidth = maxWidth - Spacing.three * 2
      val wide = maxWidth >= 760.dp
      val columns = when (view) { MindView.List -> 1; MindView.Hex -> if (wide) 7 else 5; MindView.Cards -> if (wide) 3 else 2 }
      val gap = if (view == MindView.Hex) 0.dp else 12.dp
      val itemWidth = if (view == MindView.List) contentWidth else (contentWidth - gap * (columns - 1)) / columns
      val rows = if (view == MindView.Hex) hexRows(state.items, columns) else state.items.chunked(columns)

      LazyColumn(state = listState, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = Spacing.three, vertical = Spacing.two)) {
        item(key = "controls") {
          Column(verticalArrangement = Arrangement.spacedBy(Spacing.two), modifier = Modifier.padding(bottom = Spacing.two)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
              ScreenHeader(title = "Mind")
              Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(colors.backgroundElement).clickable { navigator.openAddBookmark(null) }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Add, contentDescription = "Save a bookmark", tint = colors.primary, modifier = Modifier.size(19.dp))
              }
            }
            Row(
              modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(CircleShape).background(colors.backgroundElement).padding(horizontal = Spacing.three),
              horizontalArrangement = Arrangement.spacedBy(Spacing.two),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Icon(Icons.Filled.Search, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(17.dp))
              BasicTextField(
                value = filters.search,
                onValueChange = viewModel::setSearch,
                modifier = Modifier.weight(1f),
                singleLine = true,
                textStyle = BeeTheme.typography.body.copy(color = colors.text),
                cursorBrush = SolidColor(colors.text),
                decorationBox = { inner ->
                  if (filters.search.isEmpty()) Text("Search your Mind", style = BeeTheme.typography.body, color = colors.textSecondary)
                  inner()
                },
              )
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
              Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
                for ((value, label) in KINDS) FilterChip(label, filters.kind == value) { viewModel.setKind(value) }
              }
              ViewSwitcher(view) { viewModel.view.value = it }
            }
            if (state.labels.isNotEmpty()) {
              Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
                for (entry in state.labels) FilterChip("${entry.label} · ${entry.count}", filters.label == entry.label) { viewModel.setLabel(if (filters.label == entry.label) null else entry.label) }
              }
            }
          }
        }
        if (state.firstLoad) {
          item(key = "loading") { Box(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary) } }
        } else if (state.items.isEmpty()) {
          item(key = "empty") {
            Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.six), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.two)) {
              Text(if (filters.search.isNotBlank() || filters.kind != null || filters.label != null) "Nothing matches" else "Your Mind is empty", style = BeeTheme.typography.smallBold, color = colors.text)
              Text(
                if (filters.search.isNotBlank() || filters.kind != null || filters.label != null) "Try another search or clear the filters." else "Share a link to BeeGreat or tap + to save your first bookmark.",
                style = BeeTheme.typography.small,
                color = colors.textSecondary,
                textAlign = TextAlign.Center,
              )
            }
          }
        }
        items(rows.size, key = { rows[it].firstOrNull()?.id ?: "row-$it" }) { rowIndex ->
          val row = rows[rowIndex]
          when (view) {
            MindView.List -> for (bookmark in row) Box(modifier = Modifier.padding(bottom = Spacing.two)) { ListRow(bookmark) { navigator.openBookmark(bookmark.id) } }
            MindView.Cards ->
              Row(modifier = Modifier.fillMaxWidth().padding(bottom = gap), horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Top) {
                for (bookmark in row) Box(modifier = Modifier.width(itemWidth)) { CardCell(bookmark) { navigator.openBookmark(bookmark.id) } }
                repeat(columns - row.size) { Box(Modifier.width(itemWidth)) }
              }
            MindView.Hex -> HexRow(row, itemWidth, rowIndex == 0) { navigator.openBookmark(it.id) }
          }
        }
        if (state.loadingMore) {
          item(key = "more") { Box(modifier = Modifier.fillMaxWidth().padding(Spacing.three), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = colors.primary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp) } }
        }
      }
    }
  }
}

/** Rows for the honeycomb: odd columns drop by 3/4 of a cell so the walls interlock. */
private fun hexRows(items: List<Bookmark>, columns: Int): List<List<Bookmark>> = items.chunked(columns)

private fun hexCellHeight(width: Dp): Dp = width * 1.1547f

@Composable
private fun HexRow(row: List<Bookmark>, itemWidth: Dp, first: Boolean, onOpen: (Bookmark) -> Unit) {
  val cellHeight = hexCellHeight(itemWidth)
  // Each cell overlaps its neighbor by half a width; odd columns sit 3/4 lower; rows pull up a quarter.
  Box(modifier = Modifier.fillMaxWidth().height(cellHeight * 1.5f).offset(y = if (first) 0.dp else -(cellHeight * 0.25f))) {
    row.forEachIndexed { index, bookmark ->
      Box(modifier = Modifier.offset(x = itemWidth * 0.5f * index, y = if (index % 2 == 1) cellHeight * 0.75f else 0.dp).size(itemWidth, cellHeight)) {
        HexCell(bookmark, itemWidth) { onOpen(bookmark) }
      }
    }
  }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  Box(
    modifier =
      Modifier.heightIn(min = 32.dp)
        .clip(CircleShape)
        .background(if (selected) colors.secondary else colors.backgroundElement)
        .clickable(onClick = onClick)
        .padding(horizontal = Spacing.two + Spacing.half),
    contentAlignment = Alignment.Center,
  ) {
    Text(label, style = BeeTheme.typography.small, color = if (selected) colors.secondaryForeground else colors.textSecondary, maxLines = 1)
  }
}

@Composable
private fun ViewSwitcher(view: MindView, onChange: (MindView) -> Unit) {
  val colors = BeeTheme.colors
  Row(modifier = Modifier.clip(CircleShape).background(colors.backgroundElement).padding(2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
    for ((option, icon) in listOf(MindView.List to Icons.Filled.ViewList, MindView.Cards to Icons.Filled.GridView, MindView.Hex to Icons.Filled.Hexagon)) {
      val selected = view == option
      Box(modifier = Modifier.size(30.dp).clip(CircleShape).background(if (selected) colors.card else Color.Transparent).clickable { onChange(option) }, contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = option.name, tint = if (selected) colors.text else colors.textSecondary, modifier = Modifier.size(16.dp))
      }
    }
  }
}

@Composable
private fun KindGlyph(kind: String, size: Dp, tint: Color) {
  when (kind) {
    "youtube" -> Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = tint, modifier = Modifier.size(size))
    "tweet" -> Text("𝕏", color = tint, fontSize = (size.value * 0.8f).sp)
    else -> Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = tint, modifier = Modifier.size(size))
  }
}

@Composable
private fun ListRow(bookmark: Bookmark, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  BeeCard(onClick = onClick) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.two), verticalAlignment = Alignment.CenterVertically) {
      Box(modifier = Modifier.size(34.dp).background(Comb.labelFill, RoundedCornerShape(Radius.tile)), contentAlignment = Alignment.Center) {
        KindGlyph(bookmark.kind, 18.dp, Color(0xFFA86A16))
      }
      Column(modifier = Modifier.weight(1f)) {
        Text(bookmark.title ?: bookmark.sourceLabel(), style = BeeTheme.typography.body, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
          listOf(bookmark.sourceLabel(), bookmarkRelativeDate(bookmark.createdAt)).joinToString(" · ") + if (bookmark.status == "failed") " · failed" else if (bookmark.isWorking) " · reading…" else "",
          style = BeeTheme.typography.small,
          color = if (bookmark.status == "failed") colors.destructive else colors.textSecondary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
private fun CardCell(bookmark: Bookmark, onClick: () -> Unit) {
  val colors = BeeTheme.colors
  BeeCard(onClick = onClick, padding = 0.dp) {
    val image = bookmark.meta?.imageUrl
    if (image != null) {
      AsyncImage(model = image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().height(112.dp))
    } else {
      Box(modifier = Modifier.fillMaxWidth().height(72.dp).background(Comb.labelFill), contentAlignment = Alignment.Center) { KindGlyph(bookmark.kind, 28.dp, Color(0xFFA86A16)) }
    }
    Column(modifier = Modifier.padding(Spacing.two + Spacing.half), verticalArrangement = Arrangement.spacedBy(Spacing.one)) {
      Text(bookmark.title ?: bookmark.sourceLabel(), style = BeeTheme.typography.smallBold, color = colors.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
      bookmark.summary?.let { Text(it, style = BeeTheme.typography.small, color = colors.textSecondary, maxLines = 3, overflow = TextOverflow.Ellipsis) }
      if (bookmark.labels.isNotEmpty()) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.one)) {
          for (label in bookmark.labels.take(2)) {
            Text(label, style = BeeTheme.typography.small.copy(fontSize = 11.sp), color = Comb.labelInk, modifier = Modifier.background(Comb.labelFill, CircleShape).padding(horizontal = Spacing.two, vertical = 2.dp))
          }
        }
      }
    }
  }
}

/** One wax cell of the honeycomb: cover image or kind glyph, the title on the comb fill. */
@Composable
private fun HexCell(bookmark: Bookmark, width: Dp, onClick: () -> Unit) {
  val failed = bookmark.status == "failed"
  val fill = Brush.verticalGradient(if (failed) listOf(Comb.failedTop, Comb.failedBottom) else listOf(Comb.fillTop, Comb.fillBottom))
  Box(modifier = Modifier.fillMaxSize().clip(HexShape(0.08f)).background(fill).border(Hairline * 2, Comb.wall, HexShape(0.08f)).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
    val image = bookmark.meta?.imageUrl
    if (image != null) {
      AsyncImage(model = image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(HexShape(0.08f)))
      Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color(0x99000000)))))
    }
    Column(modifier = Modifier.padding(horizontal = width * 0.18f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.half)) {
      if (image == null) KindGlyph(bookmark.kind, width * 0.28f, Comb.text)
      Text(
        bookmark.title ?: bookmark.sourceLabel(),
        style = BeeTheme.typography.small.copy(fontSize = (width.value / 8).coerceIn(9f, 13f).sp, lineHeight = (width.value / 7).coerceIn(11f, 16f).sp),
        color = if (image != null) Color.White else Comb.text,
        textAlign = TextAlign.Center,
        maxLines = 3,
        overflow = TextOverflow.Ellipsis,
      )
    }
    if (bookmark.isWorking) CircularProgressIndicator(modifier = Modifier.size(14.dp).align(Alignment.BottomCenter).padding(bottom = 6.dp), strokeWidth = 1.5.dp, color = Comb.text)
  }
}
