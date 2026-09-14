package com.beegreat.convex

import com.beegreat.convex.raindrop.RaindropCollection
import com.beegreat.convex.raindrop.RaindropPage
import com.beegreat.convex.raindrop.RaindropStatus
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

class RaindropContractTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test fun `decodes Convex numbers without truncating Raindrop ids`() {
    val collection = json.decodeFromString<RaindropCollection>("""{"id":4000000000.0,"title":"Research","parentId":-1.0}""")
    assertEquals(4000000000L, collection.id)
    assertEquals(-1L, collection.parentId)
    val page = json.decodeFromString<RaindropPage>("""{"items":[{"id":4000000001.0,"url":"https://example.com","title":"Example","excerpt":"","note":"Read","tags":["research"],"collectionId":-99.0,"important":true,"cover":"","updatedAt":"2026-09-14T10:00:00Z"}],"hasMore":false}""")
    assertEquals(4000000001L, page.items.single().id)
    assertEquals(-99L, page.items.single().collectionId)
    assertFalse(page.hasMore)
  }

  @Test fun `decodes disconnected and syncing connection states`() {
    val disconnected = json.decodeFromString<RaindropStatus>("""{"state":"disconnected","oauthAvailable":false,"accountName":null,"syncing":false,"lastSyncedAt":null,"message":null}""")
    assertEquals("disconnected", disconnected.state)
    assertNull(disconnected.lastSyncedAt)
    val connected = json.decodeFromString<RaindropStatus>("""{"state":"connected","oauthAvailable":true,"accountName":"Reader","syncing":true,"lastSyncedAt":1789376400000.0,"message":null}""")
    assertTrue(connected.syncing)
    assertTrue(connected.oauthAvailable)
    assertEquals(1789376400000L, connected.lastSyncedAt)
  }
}
