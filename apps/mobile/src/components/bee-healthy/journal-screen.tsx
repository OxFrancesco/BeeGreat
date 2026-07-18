import { api } from '@beegreat/backend/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SectionHeader } from '@/components/bee-healthy/section-header';
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
import { formatJournalDate, type Mood } from '@/lib/bee-healthy';

const JOURNAL_MAX_LENGTH = 5000;

const PROMPTS: Record<Mood | 'unselected', string> = {
  awful: 'What would make today feel one percent gentler?',
  bad: 'What is taking up the most space in your mind?',
  okay: 'What do you want to notice before today passes?',
  good: 'What gave you a little energy today?',
  great: 'What do you want to remember from this feeling?',
  unselected: 'What do you want to remember from today?',
};

export function JournalScreen() {
  const { userId } = useAuth();
  const { localDate, timeZone } = useCurrentLocalDay();

  return (
    <JournalDay
      key={`${userId ?? 'loading'}:${localDate}:${timeZone}`}
      localDate={localDate}
      timeZone={timeZone}
      userId={userId}
    />
  );
}

function JournalDay({
  localDate,
  timeZone,
  userId,
}: {
  localDate: string;
  timeZone: string;
  userId: string | null | undefined;
}) {
  const theme = useTheme();
  const entry = useQuery(api.healthJournal.getByDate, { localDate });
  const saveJournal = useMutation(api.healthJournal.saveJournal);

  const [journalDraft, setJournalDraft] = useState<string | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);
  const journalDraftRef = useRef<string | null>(null);
  const journalSaveInFlight = useRef(false);
  const reportedDraftStorageMessages = useRef(new Set<string>());

  const persistedJournal = entry?.journal ?? '';
  const journal = journalDraft ?? persistedJournal;
  const journalDirty = journalDraft !== null && journalDraft !== persistedJournal;
  const mood = entry?.mood ?? null;

  const reportDraftStorageError = useCallback((error: unknown) => {
    const message =
      errorMessage(error) ?? 'Keep this screen open until your reflection is saved.';
    if (reportedDraftStorageMessages.current.has(message)) return;
    reportedDraftStorageMessages.current.add(message);
    Alert.alert('Offline journal storage', message);
  }, []);

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

  const handleJournalChange = useCallback(
    (value: string) => {
      journalDraftRef.current = value;
      setJournalDraft(value);
      if (!userId) return;

      void persistJournalDraft(userId, localDate, value).catch(reportDraftStorageError);
    },
    [localDate, reportDraftStorageError, userId],
  );

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

  const saveStatus = savingJournal
    ? 'Saving reflection…'
    : journalDirty
      ? 'Unsaved changes'
      : 'Reflection saved';

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <SectionHeader title="Journal" subtitle={formatJournalDate(localDate)} />
          {entry === undefined ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <>
              <ThemedText style={styles.prompt}>
                {PROMPTS[mood ?? 'unselected']}
              </ThemedText>
              <TextInput
                accessibilityLabel="Daily journal reflection"
                multiline
                maxLength={JOURNAL_MAX_LENGTH}
                onBlur={() => void handleJournalSave()}
                onChangeText={handleJournalChange}
                placeholder="Write without polishing it…"
                placeholderTextColor={theme.textSecondary}
                selectionColor="#D89B21"
                style={[
                  styles.editor,
                  {
                    color: theme.text,
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
                textAlignVertical="top"
                value={journal}
              />
              <View style={styles.editorFooter}>
                <View style={styles.editorMeta}>
                  <ThemedText
                    selectable
                    style={styles.characterCount}
                    themeColor="textSecondary"
                  >
                    {journal.length.toLocaleString()} / {JOURNAL_MAX_LENGTH.toLocaleString()}
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
                    savingJournal
                      ? 'Saving daily reflection'
                      : journalDirty
                        ? 'Save daily reflection'
                        : 'Daily reflection saved'
                  }
                  accessibilityState={{
                    busy: savingJournal,
                    disabled: !journalDirty || savingJournal,
                  }}
                  disabled={!journalDirty || savingJournal}
                  onPress={() => void handleJournalSave()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    {
                      backgroundColor: journalDirty
                        ? theme.primary
                        : theme.backgroundElement,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  {savingJournal ? (
                    <ActivityIndicator color={theme.primaryForeground} size="small" />
                  ) : (
                    <ThemedText
                      style={{
                        color: journalDirty
                          ? theme.primaryForeground
                          : theme.textSecondary,
                      }}
                      type="smallBold"
                    >
                      {journalDirty ? 'Save reflection' : 'Saved'}
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
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
    gap: Spacing.three,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
  prompt: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 600,
  },
  editor: {
    minHeight: 220,
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
  editorMeta: {
    flex: 1,
    gap: Spacing.half,
  },
  characterCount: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
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
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
