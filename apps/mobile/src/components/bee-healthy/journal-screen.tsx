import { api } from '@beegreat/backend/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BEE_DOCTOR_SOURCE } from '@/components/bee-healthy/mood-bee-assets';
import {
  JournalCalendar,
  monthStartForDate,
} from '@/components/bee-healthy/journal-calendar';
import { SectionHeader } from '@/components/bee-healthy/section-header';
import {
  JournalEntryCard,
  type JournalTimelineEntry,
} from '@/components/bee-healthy/journal-entry-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import {
  clearJournalDraft,
  loadJournalDraft,
} from '@/lib/bee-healthy-drafts';
import { dateFromLocalKey, formatJournalDate, shiftLocalDateKey } from '@/lib/bee-healthy';

type TimelineSection = {
  title: string;
  data: JournalTimelineEntry[];
};

export function JournalScreen() {
  const { userId } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { localDate, timeZone } = useCurrentLocalDay();
  const entries = useQuery(
    api.journalEntries.listRecent,
    isConvexAuthenticated
      ? {
          limit: 100,
          throughDate: localDate,
        }
      : 'skip',
  );
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthStartForDate(localDate));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEntries = useQuery(
    api.journalEntries.listDay,
    isConvexAuthenticated && selectedDate ? { localDate: selectedDate } : 'skip',
  );
  const monthDays = useQuery(
    api.journalEntries.listMonth,
    isConvexAuthenticated ? { monthStart: calendarMonth } : 'skip',
  );
  const healthEntries = useQuery(
    api.healthJournal.listRecent,
    isConvexAuthenticated
      ? {
          limit: 31,
          throughDate: localDate,
        }
      : 'skip',
  );
  const todayHealth = useQuery(
    api.healthJournal.getByDate,
    isConvexAuthenticated ? { localDate } : 'skip',
  );
  const selectedHealth = useQuery(
    api.healthJournal.getByDate,
    isConvexAuthenticated && selectedDate && selectedDate !== localDate
      ? { localDate: selectedDate }
      : 'skip',
  );
  const createDraft = useMutation(api.journalEntries.createDraft);
  const updateEntry = useMutation(api.journalEntries.update);
  const removeEntry = useMutation(api.journalEntries.remove);
  const importLegacy = useMutation(api.journalEntries.importLegacy);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(true);
  const deferredSearch = useDeferredValue(searchQuery.trim());
  const searchResults = useQuery(
    api.journalEntries.search,
    isConvexAuthenticated && deferredSearch ? { query: deferredSearch } : 'skip',
  );
  const migrationStarted = useRef(false);

  useEffect(() => {
    if (
      !isConvexAuthenticated ||
      !userId ||
      todayHealth === undefined ||
      migrationStarted.current
    ) {
      return;
    }
    migrationStarted.current = true;
    let active = true;

    void (async () => {
      try {
        const { journal: storedDraft } = await loadJournalDraft(userId, localDate);
        if (
          storedDraft !== null &&
          storedDraft.trim() &&
          storedDraft !== (todayHealth?.journal ?? '')
        ) {
          const recovered = await createDraft({
            localDate,
            timeZone,
            occurredAt: Date.now(),
          });
          await updateEntry({ entryId: recovered.id, body: storedDraft });
        }
        if (storedDraft !== null) await clearJournalDraft(userId, localDate);
        await importLegacy({});
      } catch (error) {
        if (active) {
          Alert.alert(
            'Journal migration paused',
            error instanceof Error
              ? error.message
              : 'Your existing reflections are still safe. Try opening Journal again.',
          );
        }
      } finally {
        if (active) setImporting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [
    createDraft,
    importLegacy,
    isConvexAuthenticated,
    localDate,
    timeZone,
    todayHealth,
    updateEntry,
    userId,
  ]);

  const visibleEntries = deferredSearch
    ? searchResults
    : selectedDate
      ? selectedEntries
      : entries;
  const sections = useMemo(
    () => buildTimelineSections(visibleEntries ?? [], localDate),
    [localDate, visibleEntries],
  );
  const healthByDate = useMemo(
    () => {
      const values = [...(healthEntries ?? [])];
      if (selectedHealth) values.push(selectedHealth);
      return new Map(values.map((entry) => [entry.localDate, entry]));
    },
    [healthEntries, selectedHealth],
  );

  const openNewEntry = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const targetDate = selectedDate ?? localDate;
      const entry = await createDraft({
        localDate: targetDate,
        timeZone,
        occurredAt: occurredAtForLocalDate(targetDate, localDate),
      });
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      router.push({
        pathname: '/journal-entry/[entryId]',
        params: { entryId: entry.id },
      });
    } catch (error) {
      Alert.alert(
        'Could not start a new entry',
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setCreating(false);
    }
  }, [createDraft, creating, localDate, selectedDate, timeZone]);

  const toggleFlag = useCallback(
    async (
      entry: JournalTimelineEntry,
      flag: 'isPinned' | 'isFavorite',
    ) => {
      try {
        await updateEntry({ entryId: entry.id, [flag]: !entry[flag] });
        if (process.env.EXPO_OS === 'ios') {
          void Haptics.selectionAsync();
        }
      } catch (error) {
        Alert.alert(
          'Could not update this entry',
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [updateEntry],
  );

  const confirmDelete = useCallback(
    (entry: JournalTimelineEntry) => {
      Alert.alert('Delete this entry?', 'This memory will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void removeEntry({ entryId: entry.id }).catch((cause: unknown) => {
              Alert.alert(
                'Could not delete this entry',
                cause instanceof Error ? cause.message : undefined,
              );
            });
          },
        },
      ]);
    },
    [removeEntry],
  );

  const loading = !isConvexAuthenticated || visibleEntries === undefined || importing;

  return (
    <ThemedView style={styles.container}>
      <SectionList
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        sections={sections}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(entry) => entry.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionHeader
              title="Journal"
              subtitle={formatJournalDate(selectedDate ?? localDate)}
              actions={
                <View style={styles.headerActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={calendarVisible ? 'Close journal calendar' : 'Browse journal calendar'}
                    hitSlop={Spacing.two}
                    onPress={() => setCalendarVisible((visible) => !visible)}
                    style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  >
                    <SymbolView
                      name={calendarVisible ? 'calendar.badge.minus' : 'calendar'}
                      size={18}
                      tintColor={theme.text}
                      fallback={<ThemedText type="smallBold">Calendar</ThemedText>}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={searchVisible ? 'Close journal search' : 'Search journal'}
                    hitSlop={Spacing.two}
                    onPress={() => {
                      setSearchVisible((visible) => !visible);
                      if (searchVisible) setSearchQuery('');
                    }}
                    style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  >
                    <SymbolView
                      name={searchVisible ? 'xmark' : 'magnifyingglass'}
                      size={18}
                      tintColor={theme.text}
                      fallback={<ThemedText type="smallBold">Search</ThemedText>}
                    />
                  </Pressable>
                </View>
              }
            />
            {searchVisible ? (
              <View
                style={[
                  styles.searchField,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <SymbolView
                  name="magnifyingglass"
                  size={16}
                  tintColor={theme.textSecondary}
                />
                <TextInput
                  autoFocus
                  accessibilityLabel="Search journal entries"
                  clearButtonMode="while-editing"
                  onChangeText={setSearchQuery}
                  placeholder="Search your memories"
                  placeholderTextColor={theme.textSecondary}
                  selectionColor="#D89B21"
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                />
              </View>
            ) : null}
            {calendarVisible ? (
              <JournalCalendar
                days={monthDays}
                monthStart={calendarMonth}
                onChangeMonth={setCalendarMonth}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  if (date) setCalendarMonth(monthStartForDate(date));
                }}
                selectedDate={selectedDate}
                today={localDate}
              />
            ) : null}
            {selectedDate ? (
              <View style={[styles.dayFilter, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">
                  {formatJournalDate(selectedDate)}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected journal day"
                  onPress={() => setSelectedDate(null)}
                  style={({ pressed }) => [styles.clearDayButton, pressed && styles.pressed]}
                >
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Show all
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <JournalEmptyState searching={Boolean(deferredSearch)} />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText selectable style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.entryRow}>
            <JournalEntryCard
              entry={item}
              health={healthByDate.get(item.localDate)}
              onDelete={() => confirmDelete(item)}
              onToggleFavorite={() => void toggleFlag(item, 'isFavorite')}
              onTogglePinned={() => void toggleFlag(item, 'isPinned')}
            />
          </View>
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={creating ? 'Creating journal entry' : 'Create journal entry'}
        accessibilityState={{ busy: creating, disabled: creating }}
        disabled={creating}
        onPress={() => void openNewEntry()}
        style={({ pressed }) => [
          styles.createButton,
          {
            bottom: Math.max(insets.bottom, Spacing.three) + 62,
            backgroundColor: theme.primary,
          },
          pressed && styles.createPressed,
        ]}
      >
        {creating ? (
          <ActivityIndicator color={theme.primaryForeground} size="small" />
        ) : (
          <SymbolView
            name="plus"
            size={24}
            tintColor={theme.primaryForeground}
            fallback={<ThemedText style={{ color: theme.primaryForeground }}>Add</ThemedText>}
          />
        )}
      </Pressable>
    </ThemedView>
  );
}

function occurredAtForLocalDate(targetDate: string, today: string) {
  if (targetDate === today) return Date.now();
  const date = dateFromLocalKey(targetDate);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

function JournalEmptyState({ searching }: { searching: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.emptyState,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <ExpoImage source={BEE_DOCTOR_SOURCE} contentFit="contain" style={styles.emptyBee} />
      <View style={styles.emptyCopy}>
        <ThemedText style={styles.emptyTitle}>
          {searching ? 'No matching memories' : 'A quiet place for your days'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
          {searching
            ? 'Try another word or close search to see every entry.'
            : 'Write one honest moment. Bee will keep the rest out of the way.'}
        </ThemedText>
      </View>
    </View>
  );
}

function buildTimelineSections(
  entries: JournalTimelineEntry[],
  todayKey: string,
): TimelineSection[] {
  const pinned = entries.filter((entry) => entry.isPinned);
  const groups = new Map<string, JournalTimelineEntry[]>();
  for (const entry of entries) {
    if (entry.isPinned) continue;
    const group = groups.get(entry.localDate) ?? [];
    group.push(entry);
    groups.set(entry.localDate, group);
  }

  return [
    ...(pinned.length ? [{ title: 'Pinned', data: pinned }] : []),
    ...[...groups.entries()].map(([localDate, data]) => ({
      title: formatTimelineDate(localDate, todayKey),
      data,
    })),
  ];
}

function formatTimelineDate(localDate: string, todayKey: string) {
  if (localDate === todayKey) return 'Today';
  if (localDate === shiftLocalDateKey(todayKey, -1)) return 'Yesterday';
  return dateFromLocalKey(localDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: 140,
    paddingHorizontal: Spacing.three,
  },
  header: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayFilter: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  clearDayButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  searchField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  searchInput: {
    minHeight: 46,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 500,
  },
  sectionHeader: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  entryRow: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
  emptyState: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    minHeight: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.four,
  },
  emptyBee: {
    width: 72,
    height: 72,
  },
  emptyCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  createButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    boxShadow: '0 6px 18px rgba(32, 20, 12, 0.22)',
  },
  pressed: {
    opacity: 0.72,
  },
  createPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
