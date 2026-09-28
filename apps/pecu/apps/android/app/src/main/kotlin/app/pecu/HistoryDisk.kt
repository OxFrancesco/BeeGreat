package app.pecu

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable data class HistorySnapshot(val owner: String, val at: Long, val threads: ThreadPage, val states: List<AccountState>, val active: String? = null)

class HistoryDisk(private val directory: File) {
  private val lock = Mutex()
  private fun file(owner: String): File = File(directory, MessageDigest.getInstance("SHA-256").digest(owner.toByteArray()).joinToString("") { "%02x".format(it) } + ".json")
  suspend fun read(owner: String): HistorySnapshot? = withContext(Dispatchers.IO) {
    lock.withLock {
      runCatching {
        val target = file(owner)
        if (!target.exists() || target.length() > 4_300_000) return@runCatching null
        wireJson.decodeFromString<HistorySnapshot>(target.readText()).takeIf {
          it.owner == owner && it.states.size <= 12 && System.currentTimeMillis() - it.at in 0..86_400_000
        }
      }.getOrNull()
    }
  }
  suspend fun write(owner: String, threads: ThreadPage, states: List<AccountState>, active: String? = null) = withContext(Dispatchers.IO) {
    lock.withLock {
      runCatching {
        var bytes = 0
        val bounded = states.takeLast(12).asReversed().filter { state ->
          val size = wireJson.encodeToString(state).toByteArray().size
          if (bytes + size > 4 * 1024 * 1024) false else { bytes += size; true }
        }.asReversed()
        directory.mkdirs()
        val target = file(owner)
        val temporary = File(directory, target.name + ".tmp")
        temporary.writeText(wireJson.encodeToString(HistorySnapshot(owner, System.currentTimeMillis(), threads, bounded, active)))
        check(temporary.renameTo(target))
      }
    }
    Unit
  }
  suspend fun remove(owner: String) = withContext(Dispatchers.IO) {
    lock.withLock { file(owner).delete(); File(directory, file(owner).name + ".tmp").delete() }
    Unit
  }
}
