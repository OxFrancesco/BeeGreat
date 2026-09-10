package com.beegreat.flue

import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConversationReducerTest {
  private val empty = FlueConversationState("c1", emptyList(), emptyList())

  private fun pos(index: Long) = ChunkPosition(1, index)

  @Test
  fun `deltas of one kind merge, a kind change opens a new part and closes the previous`() {
    var state = empty.apply(Chunk.MessageStarted("m1", "s1", null, null, pos(0)))
    state = state.apply(Chunk.MessageDelta("m1", "reasoning", "thinking", pos(1)))
    state = state.apply(Chunk.MessageDelta("m1", "reasoning", " more", pos(2)))
    state = state.apply(Chunk.MessageDelta("m1", "text", "Hello", pos(3)))
    state = state.apply(Chunk.MessageDelta("m1", "text", " world", pos(4)))
    val parts = state.messages.single().parts
    assertEquals(listOf(FluePart.Reasoning("thinking more", "done"), FluePart.Text("Hello world", "streaming")), parts)
    state = state.apply(Chunk.MessageCompleted("m1", pos(5)))
    assertEquals("done", (state.messages.single().parts.last() as FluePart.Text).state)
  }

  @Test
  fun `tool input closes streaming text and tool output updates the last matching call`() {
    var state = empty.apply(Chunk.MessageStarted("m1", "s1", null, null, pos(0)))
    state = state.apply(Chunk.MessageDelta("m1", "text", "Looking", pos(1)))
    state = state.apply(Chunk.ToolInput("m1", "call1", "get_goals", JsonPrimitive(1), pos(2)))
    state = state.apply(Chunk.ToolInput("m1", "call1", "get_goals", JsonPrimitive(1), pos(3)))
    state = state.apply(Chunk.ToolOutput("call1", JsonPrimitive("ok"), 42, pos(4)))
    val parts = state.messages.single().parts
    assertEquals(2, parts.size)
    assertEquals("done", (parts[0] as FluePart.Text).state)
    val tool = parts[1] as FluePart.Tool
    assertEquals("output-available", tool.state)
    assertEquals(JsonPrimitive("ok"), tool.output)
    assertEquals(42L, tool.durationMs)
  }

  @Test
  fun `a started chunk for an existing message is a no-op continuation`() {
    val state = empty.apply(Chunk.MessageStarted("m1", "s1", null, null, pos(0))).apply(Chunk.MessageStarted("m1", "s1", null, null, pos(1)))
    assertEquals(1, state.messages.size)
  }

  @Test
  fun `settlements upsert by submission`() {
    val state =
      empty
        .apply(Chunk.SubmissionSettled(FlueSettlement("s1", "completed"), pos(0)))
        .apply(Chunk.SubmissionSettled(FlueSettlement("s1", "failed"), pos(1)))
    assertEquals(listOf(FlueSettlement("s1", "failed")), state.settlements)
  }

  @Test
  fun `parts and messages round trip through JSON without null noise`() {
    val message =
      FlueMessage(
        id = "m1",
        role = "assistant",
        parts = listOf(FluePart.Text("hi", "done"), FluePart.Tool("t", "c", "input-available", input = JsonPrimitive(3))),
      )
    val json = FlueJson.encodeToString(FlueMessage.serializer(), message)
    assertTrue(json, !json.contains("null"))
    assertEquals(message, FlueJson.decodeFromString(FlueMessage.serializer(), json))
  }

  @Test
  fun `unknown part types survive a round trip`() {
    val json = """{"id":"m","role":"assistant","purpose":"assistant","display":"visible","parts":[{"type":"data-weather","data":{"c":21}}]}"""
    val message = FlueJson.decodeFromString(FlueMessage.serializer(), json)
    assertEquals("data-weather", (message.parts.single() as FluePart.Other).type)
    assertEquals(json, FlueJson.encodeToString(FlueMessage.serializer(), message))
  }

  @Test
  fun `chunk positions compare batch then index`() {
    assertTrue(ChunkPosition(1, 9) < ChunkPosition(2, 0))
    assertTrue(ChunkPosition(2, 1) > ChunkPosition(2, 0))
  }
}
