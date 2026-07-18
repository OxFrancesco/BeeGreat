import { api } from '@beegreat/backend/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { MoodTracker } from '@/components/bee-healthy/mood-tracker';
import { SectionHeader } from '@/components/bee-healthy/section-header';
import { WeekPulse } from '@/components/bee-healthy/week-pulse';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import { formatJournalDate, type Mood } from '@/lib/bee-healthy';

export function MoodScreen() {
  const { userId } = useAuth();
  const { date, localDate, timeZone } = useCurrentLocalDay();

  return (
    <MoodDay
      key={`${userId ?? 'loading'}:${localDate}:${timeZone}`}
      localDate={localDate}
      timeZone={timeZone}
      today={date}
    />
  );
}

function MoodDay({
  localDate,
  timeZone,
  today,
}: {
  localDate: string;
  timeZone: string;
  today: Date;
}) {
  const theme = useTheme();
  const entry = useQuery(api.healthJournal.getByDate, { localDate });
  const history = useQuery(api.healthJournal.listRecent, {
    limit: 7,
    throughDate: localDate,
  });
  const setMood = useMutation(api.healthJournal.setMood);

  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(null);
  const moodRequestVersion = useRef(0);
  const mood = optimisticMood ?? entry?.mood ?? null;

  const handleMoodChange = useCallback(
    async (nextMood: Mood) => {
      const requestVersion = ++moodRequestVersion.current;
      setOptimisticMood(nextMood);
      try {
        await setMood({ localDate, timeZone, mood: nextMood });
        if (requestVersion === moodRequestVersion.current) {
          setOptimisticMood(null);
        }
      } catch (error) {
        if (requestVersion === moodRequestVersion.current) {
          setOptimisticMood(null);
        }
        Alert.alert(
          'Could not save your mood',
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [localDate, setMood, timeZone],
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <SectionHeader title="How are you?" subtitle={formatJournalDate(localDate)} />
          {entry === undefined ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <MoodTracker value={mood} onChange={(next) => void handleMoodChange(next)} />
          )}
          <View style={styles.week}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Last 7 days
            </ThemedText>
            <WeekPulse today={today} entries={history ?? []} />
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
  week: {
    gap: Spacing.two,
  },
});
