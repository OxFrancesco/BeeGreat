import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  HYDRATION_GOAL_ML,
  MOODS,
  type Mood,
  localDateKey,
} from '@/lib/bee-healthy';

export type WeekPulseEntry = {
  localDate: string;
  mood: Mood | null;
  hydrationMl: number;
  journal: string;
};

export function WeekPulse({
  today,
  entries,
}: {
  today: Date;
  entries: WeekPulseEntry[];
}) {
  const theme = useTheme();
  const days = useMemo(() => lastSevenDays(today), [today]);
  const entryByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.localDate, entry])),
    [entries],
  );
  const todayKey = localDateKey(today);

  return (
    <View style={styles.row}>
      {days.map((date) => {
        const key = localDateKey(date);
        const dayEntry = entryByDate.get(key);
        const mood = dayEntry?.mood
          ? MOODS.find((option) => option.value === dayEntry.mood)
          : null;
        const hydration = Math.min(1, (dayEntry?.hydrationMl ?? 0) / HYDRATION_GOAL_ML);
        const isToday = key === todayKey;

        return (
          <View
            key={key}
            accessible
            accessibilityLabel={weekDayAccessibilityLabel(date, dayEntry)}
            style={styles.day}
          >
            <ThemedText
              style={[styles.dayName, isToday && { color: theme.primary }]}
              themeColor="textSecondary"
            >
              {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </ThemedText>
            <View
              style={[
                styles.dayOrb,
                {
                  borderColor: isToday ? '#E4A72C' : theme.border,
                  backgroundColor: mood?.softColor ?? theme.backgroundElement,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.moodScore,
                  { color: mood ? '#3D322B' : theme.textSecondary },
                ]}
              >
                {mood ? MOODS.findIndex((option) => option.value === mood.value) + 1 : '–'}
              </ThemedText>
            </View>
            <View style={[styles.waterTrack, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.waterFill, { width: `${hydration * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function lastSevenDays(today: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
}

function weekDayAccessibilityLabel(date: Date, entry?: WeekPulseEntry) {
  const day = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (!entry) return `${day}, no check-in`;
  const mood = entry.mood
    ? MOODS.find((option) => option.value === entry.mood)?.label
    : 'not logged';
  return `${day}, mood ${mood}, ${entry.hydrationMl} millilitres of water${entry.journal.trim() ? ', reflection saved' : ''}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  day: {
    minWidth: 36,
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayName: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
  },
  dayOrb: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 15,
  },
  moodScore: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  waterTrack: {
    width: 26,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  waterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#55BEE2',
  },
});
