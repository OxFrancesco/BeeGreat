package com.beegreat.app.mind

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.beegreat.convex.bookmarks.Bookmark
import com.beegreat.convex.bookmarks.BookmarksPage
import com.beegreat.convex.bookmarks.BookmarksRepository
import com.beegreat.convex.bookmarks.LabelCount
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update

enum class MindView {
  List,
  Cards,
  Hex,
}

data class MindFilters(val kind: String? = null, val label: String? = null, val search: String = "")

data class MindState(
  val items: List<Bookmark> = emptyList(),
  val labels: List<LabelCount> = emptyList(),
  val firstLoad: Boolean = true,
  val loadingMore: Boolean = false,
  val canLoadMore: Boolean = false,
)

private const val PAGE_SIZE = 24

/** Port of `LiveMindScreen`: filters, search, and cursor pagination over `bookmarks:list` / `bookmarks:searchPage`. */
class MindViewModel(private val repository: BookmarksRepository) : ViewModel() {
  val filters = MutableStateFlow(MindFilters())
  val view = MutableStateFlow(MindView.List)
  private val cursors = MutableStateFlow<List<String?>>(listOf(null))
  private var latestContinueCursor: String? = null

  @OptIn(ExperimentalCoroutinesApi::class, FlowPreview::class)
  private val pages =
    filters
      .debounce { if (it.search.isBlank()) 0L else 200L }
      .distinctUntilChanged()
      .flatMapLatest { current ->
        cursors.value = listOf(null)
        cursors.flatMapLatest { cursorList ->
          val flows =
            cursorList.map { cursor ->
              val query = current.search.trim()
              val flow =
                if (query.isEmpty()) repository.page(current.kind, current.label, PAGE_SIZE, cursor)
                else repository.searchPage(query, current.kind, current.label, PAGE_SIZE, cursor)
              flow.map { it.getOrNull() }
            }
          if (flows.isEmpty()) flowOf(emptyList<BookmarksPage?>()) else combine(flows) { it.toList() }
        }
      }

  val state: StateFlow<MindState> =
    combine(pages, repository.labels().map { it.getOrNull() ?: emptyList() }, cursors) { loaded, labels, cursorList ->
        val ready = loaded.filterNotNull()
        val last = ready.lastOrNull()
        latestContinueCursor = last?.continueCursor
        MindState(
          items = ready.flatMap { it.page },
          labels = labels,
          firstLoad = ready.isEmpty(),
          loadingMore = ready.size < cursorList.size,
          canLoadMore = last != null && !last.isDone,
        )
      }
      .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MindState())

  fun loadMore() {
    val next = latestContinueCursor ?: return
    val current = state.value
    if (!current.canLoadMore || current.loadingMore || next in cursors.value) return
    cursors.update { it + next }
  }

  fun setKind(kind: String?) = filters.update { it.copy(kind = kind) }

  fun setLabel(label: String?) = filters.update { it.copy(label = label) }

  fun setSearch(search: String) = filters.update { it.copy(search = search) }
}
