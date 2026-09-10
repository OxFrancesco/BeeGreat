package com.beegreat.contract

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BookmarksTest {
  @Test
  fun `normalizes bare domains and rejects non-web schemes`() {
    assertEquals("https://example.com", normalizeBookmarkInputUrl("example.com"))
    assertEquals("https://example.com/a", normalizeBookmarkInputUrl("//example.com/a"))
    assertEquals("http://example.com/x", normalizeBookmarkInputUrl("http://example.com/x"))
    assertNull(normalizeBookmarkInputUrl("mailto:a@b.co"))
    assertNull(normalizeBookmarkInputUrl("   "))
  }

  @Test
  fun `pulls the first link out of shared text`() {
    assertEquals("https://x.com/a/status/1", urlFromSharedText("Look at this https://x.com/a/status/1."))
    assertEquals("https://example.org", urlFromSharedText("example.org"))
  }

  @Test
  fun `relative dates`() {
    val now = 1_800_000_000_000L
    assertEquals("today", bookmarkRelativeDate(now, now))
    assertEquals("yesterday", bookmarkRelativeDate(now - 86_400_000L, now))
    assertEquals("12d ago", bookmarkRelativeDate(now - 12 * 86_400_000L, now))
  }
}
