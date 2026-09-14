package com.beegreat.app.mind

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.beegreat.convex.raindrop.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class RaindropState(
  val status: RaindropStatus? = null,
  val collections: List<RaindropCollection> = emptyList(),
  val bookmarks: List<RaindropBookmark> = emptyList(),
  val collectionId: Long = 0, val search: String = "", val page: Int = 0,
  val loading: Boolean = false, val working: Boolean = false, val hasMore: Boolean = false,
  val error: String? = null,
)

class RaindropViewModel(private val repository: RaindropRepository) : ViewModel() {
  private val mutable = MutableStateFlow(RaindropState())
  val state = mutable.asStateFlow()
  private var load: Job? = null
  private var generation = 0

  init {
    viewModelScope.launch {
      repository.status().collect { result ->
        result.onSuccess { status ->
          val connected = mutable.value.status?.state == "connected"
          mutable.update { it.copy(status = status) }
          if (status.state == "connected" && !connected) refresh()
          if (status.state != "connected") {
            generation++; load?.cancel()
            mutable.update { it.copy(bookmarks = emptyList(), collections = emptyList(), loading = false, hasMore = false) }
          }
        }.onFailure { mutable.update { it.copy(error = "Could not load the Raindrop connection. Check your connection and try again.") } }
      }
    }
  }

  fun search(value: String) { mutable.update { it.copy(search = value) }; fetch(reset = true, debounce = true) }
  fun collection(id: Long) { mutable.update { it.copy(collectionId = id) }; fetch(reset = true) }
  fun refresh() = fetch(reset = true, refreshCollections = true)
  fun more() { if (!mutable.value.loading && mutable.value.hasMore) fetch(reset = false) }
  private fun fetch(reset: Boolean, debounce: Boolean = false, refreshCollections: Boolean = false) {
    load?.cancel()
    val version = ++generation
    val snapshot = mutable.value
    val page = if (reset) 0 else snapshot.page + 1
    mutable.update { it.copy(loading = true, error = null, bookmarks = if (reset) emptyList() else it.bookmarks, hasMore = if (reset) false else it.hasMore) }
    load = viewModelScope.launch {
      try {
        if (debounce) delay(300)
        if (refreshCollections) {
          val collections = repository.collections()
          if (version == generation) mutable.update { it.copy(collections = collections) }
        }
        val result = repository.bookmarks(snapshot.collectionId, snapshot.search, page)
        if (version == generation) mutable.update { it.copy(bookmarks = (if (reset) result.items else it.bookmarks + result.items).distinctBy { bookmark -> bookmark.id }, page = page, hasMore = result.hasMore) }
      } catch (cancel: CancellationException) { throw cancel }
      catch (error: Exception) { if (version == generation) mutable.update { it.copy(error = "Could not load bookmarks. Try again.") } }
      finally { if (version == generation) mutable.update { it.copy(loading = false) } }
    }
  }
  fun action(block: suspend () -> Unit) {
    if (mutable.value.working) return
    mutable.update { it.copy(working = true, error = null) }
    viewModelScope.launch {
      try { block() }
      catch (cancel: CancellationException) { throw cancel }
      catch (error: Exception) { mutable.update { it.copy(error = "Could not complete the Raindrop request. Check your connection and try again.") } }
      finally { mutable.update { it.copy(working = false) } }
    }
  }
  fun error(message: String) { mutable.update { it.copy(error = message) } }
}
