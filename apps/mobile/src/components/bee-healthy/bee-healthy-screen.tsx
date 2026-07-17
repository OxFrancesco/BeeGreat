import { api } from '@beegreat/backend/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AccessibilityInfo,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { HydrationTracker } from '@/components/bee-healthy/hydration-tracker';
import { MoodTracker } from '@/components/bee-healthy/mood-tracker';
import { ScreenHeader } from '@/components/goals/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import {
  clearJournalDraft,
  loadJournalDraft,
  persistJournalDraft,
} from '@/lib/bee-healthy-drafts';
import {
  HYDRATION_GOAL_ML,
  MAX_HYDRATION_ML,
  MOODS,
  type Mood,
  localDateKey,
} from '@/lib/bee-healthy';

const JOURNAL_MAX_LENGTH = 5000;

const PROMPTS: Record<Mood | 'unselected', string> = {
  awful: 'What would make today feel one percent gentler?',
  bad: 'What is taking up the most space in your mind?',
  okay: 'What do you want to notice before today passes?',
  good: 'What gave you a little energy today?',
  great: 'What do you want to remember from this feeling?',
  unselected: 'What do you want to remember from today?',
};

export function BeeHealthyScreen() {
  const { userId } = useAuth();
  const { date, localDate, timeZone } = useCurrentLocalDay();

  return (
    <BeeHealthyDayScreen
      key={`${userId ?? 'loading'}:${localDate}:${timeZone}`}
      localDate={localDate}
      timeZone={timeZone}
      today={date}
      userId={userId}
    />
  );
}

function BeeHealthyDayScreen({
  localDate,
  timeZone,
  today,
  userId,
}: {
  localDate: string;
  timeZone: string;
  today: Date;
  userId: string | null | undefined;
}) {
  const theme = useTheme();
  const entry = useQuery(api.healthJournal.getByDate, { localDate });
  const history = useQuery(api.healthJournal.listRecent, {
    limit: 7,
    throughDate: localDate,
  });
  const setMood = useMutation(api.healthJournal.setMood);
  const adjustHydration = useMutation(api.healthJournal.adjustHydration);
  const saveJournal = useMutation(api.healthJournal.saveJournal);

  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(null);
  const [optimisticHydration, setOptimisticHydration] = useState<number | null>(null);
  const [journalDraft, setJournalDraft] = useState<string | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);
  const [lastAddedMl, setLastAddedMl] = useState<number | null>(null);
  const moodRequestVersion = useRef(0);
  const hydrationRequestVersion = useRef(0);
  const journalDraftRef = useRef<string | null>(null);
  const journalSaveInFlight = useRef(false);
  const reportedDraftStorageMessages = useRef(new Set<string>());

  const persistedMood = entry?.mood ?? null;
  const mood = optimisticMood ?? persistedMood;
  const persistedHydration = entry?.hydrationMl ?? 0;
  const hydrationMl = optimisticHydration ?? persistedHydration;
  const hydrationValueRef = useRef(hydrationMl);
  const persistedJournal = entry?.journal ?? '';
  const journal = journalDraft ?? persistedJournal;
  const journalDirty = journalDraft !== null && journalDraft !== persistedJournal;
  const reportDraftStorageError = useCallback((error: unknown) => {
    const message =
      errorMessage(error) ?? 'Keep this screen open until your reflection is saved.';
    if (reportedDraftStorageMessages.current.has(message)) return;
    reportedDraftStorageMessages.current.add(message);
    Alert.alert(
      'Offline journal storage',
      message,
    );
  }, []);

  useEffect(() => {
    hydrationValueRef.current = hydrationMl;
  }, [hydrationMl]);

  useEffect(() => {
    if (lastAddedMl === null) return;
    const timeout = setTimeout(() => setLastAddedMl(null), 5000);
    return () => clearTimeout(timeout);
  }, [lastAddedMl]);

  useEffect(() => {
    if (!userId || entry === undefined) return;
    let active = true;

    void loadJournalDraft(userId, localDate)
      .then(({ journal: storedDraft, storageWarning }) => {
        if (!active) return;
        if (storageWarning) {
          reportDraftStorageError(new Error(storageWarning));
        }
        if (storedDraft === null || journalDraftRef.current !== null) return;
        if (storedDraft === persistedJournal) {
          void clearJournalDraft(userId, localDate).catch(reportDraftStorageError);
          return;
        }
        journalDraftRef.current = storedDraft;
        setJournalDraft(storedDraft);
      })
      .catch((error) => {
        if (!active) return;
        reportDraftStorageError(error);
      });

    return () => {
      active = false;
    };
  }, [entry, localDate, persistedJournal, reportDraftStorageError, userId]);

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
        Alert.alert('Could not save your mood', errorMessage(error));
      }
    },
    [localDate, setMood, timeZone],
  );

  const handleHydrationChange = useCallback(
    async (deltaMl: number, showUndo: boolean) => {
      const currentMl = hydrationValueRef.current;
      const nextMl = Math.min(
        MAX_HYDRATION_ML,
        Math.max(0, currentMl + deltaMl),
      );
      const appliedDeltaMl = nextMl - currentMl;
      if (appliedDeltaMl === 0) return;

      const requestVersion = ++hydrationRequestVersion.current;
      hydrationValueRef.current = nextMl;
      setOptimisticHydration(nextMl);
      try {
        const result = await adjustHydration({
          localDate,
          timeZone,
          deltaMl: appliedDeltaMl,
        });
        if (requestVersion === hydrationRequestVersion.current) {
          setOptimisticHydration(null);
          if (showUndo && result.appliedDeltaMl > 0) {
            setLastAddedMl(result.appliedDeltaMl);
            if (process.env.EXPO_OS === 'ios') {
              AccessibilityInfo.announceForAccessibility(
                `Added ${result.appliedDeltaMl} millilitres. Undo available.`,
              );
            }
          }
        }
      } catch (error) {
        if (requestVersion === hydrationRequestVersion.current) {
          setOptimisticHydration(null);
          setLastAddedMl(null);
        }
        Alert.alert('Could not update your water', errorMessage(error));
      }
    },
    [adjustHydration, localDate, timeZone],
  );

  const handleJournalChange = useCallback((value: string) => {
    journalDraftRef.current = value;
    setJournalDraft(value);
    if (!userId) return;

    void persistJournalDraft(userId, localDate, value).catch(reportDraftStorageError);
  }, [localDate, reportDraftStorageError, userId]);

  const handleJournalSave = useCallback(async () => {
    if (journalSaveInFlight.current) return;

    let snapshot = journalDraftRef.current;
    if (snapshot === null || snapshot === persistedJournal) return;

    journalSaveInFlight.current = true;
    setSavingJournal(true);
    if (process.env.EXPO_OS === 'ios') {
      AccessibilityInfo.announceForAccessibility('Saving reflection.');
    }
    try {
      while (snapshot !== null) {
        await saveJournal({ localDate, timeZone, journal: snapshot });

        if (journalDraftRef.current === snapshot) {
          journalDraftRef.current = null;
          setJournalDraft((current) => (current === snapshot ? null : current));
          if (userId) {
            await clearJournalDraft(userId, localDate).catch(reportDraftStorageError);
          }
          break;
        }

        snapshot = journalDraftRef.current;
      }
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility('Reflection saved.');
      }
    } catch (error) {
      Alert.alert('Could not save your reflection', errorMessage(error));
    } finally {
      journalSaveInFlight.current = false;
      setSavingJournal(false);
    }
  }, [localDate, persistedJournal, reportDraftStorageError, saveJournal, timeZone, userId]);

  const completionCount =
    Number(Boolean(mood)) + Number(hydrationMl > 0) + Number(Boolean(journal.trim()));

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: Spacing.two,
          paddingBottom: Spacing.six,
          paddingHorizontal: Spacing.three,
        }}
      >
        <View style={styles.content}>
          <ScreenHeader title="Bee Healthy" showBack />

          <View style={styles.intro}>
            <View style={styles.introCopy}>
              <ThemedText style={styles.dateLabel} themeColor="textSecondary">
                {formatLongDate(today)}
              </ThemedText>
              <ThemedText style={styles.ritualTitle}>Your daily weather</ThemedText>
              <ThemedText themeColor="textSecondary">
                A small pause for your mind and body.
              </ThemedText>
            </View>
            <View
              accessible
              accessibilityLabel={`${completionCount} of 3 daily check-in steps complete`}
              style={[
                styles.completionBadge,
                { backgroundColor: theme.secondary, borderColor: theme.primary },
              ]}
            >
              <ThemedText
                style={[styles.completionNumber, { color: theme.secondaryForeground }]}
              >
                {completionCount}
              </ThemedText>
              <ThemedText
                style={[styles.completionTotal, { color: theme.secondaryForeground }]}
              >
                /3
              </ThemedText>
            </View>
          </View>

          <WeekPulse today={today} entries={history ?? []} />

          {entry === undefined ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <>
              <View
                style={[
                  styles.trackerCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <RitualSectionHeader
                  number="01"
                  title="How are you, really?"
                  subtitle="Pick the feeling that is closest"
                  tone="mood"
                />
                <MoodTracker value={mood} onChange={handleMoodChange} />
              </View>

              <View style={styles.sectionGap}>
                <View
                  style={[
                    styles.trackerCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <RitualSectionHeader
                    number="02"
                    title="Water the garden"
                    subtitle="A little at a time still counts"
                    tone="water"
                  />
                  <HydrationTracker
                    valueMl={hydrationMl}
                    goalMl={HYDRATION_GOAL_ML}
                    onAdd={(amountMl) => void handleHydrationChange(amountMl, true)}
                    onRemove={(amountMl) => void handleHydrationChange(-amountMl, false)}
                  />
                </View>
                {lastAddedMl !== null ? (
                  <Animated.View
                    entering={FadeInDown.duration(180)}
                    exiting={FadeOut.duration(140)}
                    style={[styles.undoBar, { backgroundColor: theme.backgroundElement }]}
                  >
                    <ThemedText accessibilityLiveRegion="assertive" type="small">
                      Added {lastAddedMl} ml. Undo available.
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Undo adding ${lastAddedMl} millilitres`}
                      hitSlop={Spacing.two}
                      onPress={() => {
                        const amount = lastAddedMl;
                        setLastAddedMl(null);
                        void handleHydrationChange(-amount, false);
                      }}
                    >
                      <ThemedText style={[styles.undoLabel, { color: theme.primary }]}>Undo</ThemedText>
                    </Pressable>
                  </Animated.View>
                ) : null}
              </View>

              <JournalEditor
                value={journal}
                prompt={PROMPTS[mood ?? 'unselected']}
                dirty={journalDirty}
                saving={savingJournal}
                onChange={handleJournalChange}
                onBlur={() => void handleJournalSave()}
                onSave={() => void handleJournalSave()}
              />
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function RitualSectionHeader({
  number,
  title,
  subtitle,
  tone,
}: {
  number: string;
  title: string;
  subtitle: string;
  tone: 'mood' | 'water';
}) {
  return (
    <View style={styles.sectionHeading}>
      <View
        style={[
          styles.sectionNumber,
          tone === 'water' && styles.sectionNumberWater,
        ]}
      >
        <ThemedText
          style={[
            styles.sectionNumberText,
            tone === 'water' && styles.sectionNumberTextWater,
          ]}
        >
          {number}
        </ThemedText>
      </View>
      <View style={styles.sectionHeadingCopy}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

function WeekPulse({
  today,
  entries,
}: {
  today: Date;
  entries: {
    localDate: string;
    mood: Mood | null;
    hydrationMl: number;
    journal: string;
  }[];
}) {
  const theme = useTheme();
  const days = useMemo(() => lastSevenDays(today), [today]);
  const entryByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.localDate, entry])),
    [entries],
  );
  const todayKey = localDateKey(today);

  return (
    <View style={[styles.weekCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {days.map((date) => {
        const key = localDateKey(date);
        const dayEntry = entryByDate.get(key);
        const mood = dayEntry?.mood
          ? MOODS.find((option) => option.value === dayEntry.mood)
          : null;
        const hydration = Math.min(1, (dayEntry?.hydrationMl ?? 0) / HYDRATION_GOAL_ML);
        const complete = Boolean(dayEntry?.mood && dayEntry?.hydrationMl && dayEntry?.journal.trim());
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
                  borderColor: isToday ? '#E4A72C' : complete ? '#88AE76' : theme.border,
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
              {complete ? (
                <View style={[styles.completeMark, { backgroundColor: theme.primary }]}>
                  <ThemedText
                    style={[styles.completeMarkText, { color: theme.primaryForeground }]}
                  >
                    ✓
                  </ThemedText>
                </View>
              ) : null}
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

function JournalEditor({
  value,
  prompt,
  dirty,
  saving,
  onChange,
  onBlur,
  onSave,
}: {
  value: string;
  prompt: string;
  dirty: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onSave: () => void;
}) {
  const theme = useTheme();
  const saveStatus = saving
    ? 'Saving reflection…'
    : dirty
      ? 'Unsaved changes'
      : 'Reflection saved';

  return (
    <View style={[styles.journalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionNumber}>
          <ThemedText style={styles.sectionNumberText}>03</ThemedText>
        </View>
        <View style={styles.sectionHeadingCopy}>
          <ThemedText style={styles.sectionTitle}>Leave a little note</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Private to your daily journal
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.prompt}>{prompt}</ThemedText>
      <TextInput
        accessibilityLabel="Daily journal reflection"
        multiline
        maxLength={JOURNAL_MAX_LENGTH}
        onBlur={onBlur}
        onChangeText={onChange}
        placeholder="Write without polishing it…"
        placeholderTextColor={theme.textSecondary}
        selectionColor="#D89B21"
        style={[
          styles.editor,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
        textAlignVertical="top"
        value={value}
      />
      <View style={styles.editorFooter}>
        <View style={styles.editorMeta}>
          <ThemedText
            selectable
            style={styles.characterCount}
            themeColor="textSecondary"
          >
            {value.length.toLocaleString()} / {JOURNAL_MAX_LENGTH.toLocaleString()}
          </ThemedText>
          <ThemedText
            accessibilityLiveRegion="polite"
            accessible
            style={styles.saveStatus}
            themeColor="textSecondary"
          >
            {saveStatus}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saving
              ? 'Saving daily reflection'
              : dirty
                ? 'Save daily reflection'
                : 'Daily reflection saved'
          }
          accessibilityState={{ busy: saving, disabled: !dirty || saving }}
          disabled={!dirty || saving}
          onPress={onSave}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: dirty ? theme.primary : theme.backgroundElement },
            pressed && styles.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={theme.primaryForeground} size="small" />
          ) : (
            <ThemedText
              style={{ color: dirty ? theme.primaryForeground : theme.textSecondary }}
              type="smallBold"
            >
              {dirty ? 'Save reflection' : 'Saved'}
            </ThemedText>
          )}
        </Pressable>
      </View>
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

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function weekDayAccessibilityLabel(
  date: Date,
  entry?: { mood: Mood | null; hydrationMl: number; journal: string },
) {
  const day = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (!entry) return `${day}, no check-in`;
  const mood = entry.mood ? MOODS.find((option) => option.value === entry.mood)?.label : 'not logged';
  return `${day}, mood ${mood}, ${entry.hydrationMl} millilitres of water${entry.journal.trim() ? ', reflection saved' : ''}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  introCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  dateLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  ritualTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  completionBadge: {
    minWidth: 62,
    height: 62,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 31,
    paddingTop: 14,
  },
  completionNumber: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  completionTotal: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  weekCard: {
    flexDirection: 'row',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
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
    position: 'relative',
  },
  moodScore: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  completeMark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 13,
    height: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  completeMarkText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
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
  loading: {
    paddingVertical: Spacing.six,
  },
  sectionGap: {
    gap: Spacing.two,
  },
  trackerCard: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  undoBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  undoLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  journalCard: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sectionNumber: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#FFF0C2',
  },
  sectionNumberText: {
    color: '#6D4B0D',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  sectionNumberWater: {
    backgroundColor: '#DDF2F7',
  },
  sectionNumberTextWater: {
    color: '#245C70',
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: 700,
  },
  prompt: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 600,
  },
  editor: {
    minHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: 500,
  },
  editorFooter: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  characterCount: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  editorMeta: {
    flex: 1,
    gap: Spacing.half,
  },
  saveStatus: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
  },
  saveButton: {
    minHeight: 44,
    minWidth: 122,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
