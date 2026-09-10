package com.beegreat.contract

import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

// Port of packages/tool-presentation/src/health-moods.ts and apps/mobile/src/lib/bee-healthy.ts.

data class MoodOption(val value: String, val label: String, val color: Long, val softColor: Long)

val MOODS =
  listOf(
    MoodOption("awful", "Awful", 0xFFD96F5C, 0xFFF8DDD7),
    MoodOption("bad", "Bad", 0xFFC98B48, 0xFFF6E5D1),
    MoodOption("okay", "Okay", 0xFFD9A63E, 0xFFF8EDCE),
    MoodOption("good", "Good", 0xFF75A469, 0xFFE1EDDD),
    MoodOption("great", "Great", 0xFF449487, 0xFFD9ECE8),
  )

fun moodOption(value: String?): MoodOption? = MOODS.firstOrNull { it.value == value }

const val HYDRATION_GOAL_ML = 2_000
const val MAX_HYDRATION_ML = 10_000

private val KEY = DateTimeFormatter.ofPattern("yyyy-MM-dd")

/** A calendar-day key in the device's local timezone. */
fun localDateKey(date: LocalDate = LocalDate.now()): String = KEY.format(date)

fun dateFromLocalKey(key: String): LocalDate = LocalDate.parse(key, KEY)

fun shiftLocalDateKey(key: String, days: Long): String = localDateKey(dateFromLocalKey(key).plusDays(days))

fun isTodayLocalKey(key: String): Boolean = key == localDateKey()

fun formatJournalDate(key: String, locale: Locale = Locale.getDefault()): String =
  DateTimeFormatter.ofPattern("EEEE, MMMM d", locale).format(dateFromLocalKey(key))

fun monthStartKey(key: String): String = localDateKey(dateFromLocalKey(key).withDayOfMonth(1))

/** Mood label and hydration percent, or the ritual prompt when nothing is logged. */
fun healthSummary(mood: String?, hydrationMl: Int): String {
  val option = moodOption(mood)
  val percent = minOf(100, Math.round(hydrationMl * 100.0 / HYDRATION_GOAL_ML).toInt())
  return if (option != null || hydrationMl > 0) "${option?.label ?: "Mood not checked"} · $percent% hydrated" else "Mood, water, and one honest thought"
}
