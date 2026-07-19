import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  JournalCalendar,
  monthStartForDate,
} from '@/components/bee-healthy/journal-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MOODS,
  dateFromLocalKey,
  formatJournalDate,
  localDateKey,
  type Mood,
} from '@/lib/bee-healthy';
import { journalShareText } from '@/lib/journal-share';

const BODY_MAX_LENGTH = 50_000;
const TITLE_MAX_LENGTH = 160;
const AUTOSAVE_DELAY_MS = 650;

const PROMPTS: Record<Mood | 'unselected', string> = {
  awful: 'What would make today feel one percent gentler?',
  bad: 'What is taking up the most space in your mind?',
  okay: 'What do you want to notice before today passes?',
  good: 'What gave you a little energy today?',
  great: 'What do you want to remember from this feeling?',
  unselected: 'What do you want to remember from today?',
};

type Draft = { title: string; body: string; tags: string[] };
type SaveState = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';

export function JournalEntryEditorScreen() {
  const theme = useTheme();
  const { entryId: routeEntryId } = useLocalSearchParams<{ entryId: string }>();
  const entryId = routeEntryId as Id<'journalEntries'>;
  const entry = useQuery(api.journalEntries.get, entryId ? { entryId } : 'skip');
  const updateEntry = useMutation(api.journalEntries.update);
  const removeEntry = useMutation(api.journalEntries.remove);
  const generatePhotoUploadUrl = useMutation(api.journalEntries.generatePhotoUploadUrl);
  const addPhoto = useMutation(api.journalEntries.addPhoto);
  const removePhoto = useMutation(api.journalEntries.removePhoto);
  const photos = useQuery(
    api.journalEntries.listPhotos,
    entryId ? { entryId } : 'skip',
  );
  const health = useQuery(
    api.healthJournal.getByDate,
    entry ? { localDate: entry.localDate } : 'skip',
  );

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dateEditing, setDateEditing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    monthStartForDate(localDateKey()),
  );
  const monthDays = useQuery(api.journalEntries.listMonth, {
    monthStart: calendarMonth,
  });
  const [saveState, setSaveState] = useState<SaveState>('loading');
  const hydratedEntryId = useRef<string | null>(null);
  const latestDraft = useRef<Draft>({ title: '', body: '', tags: [] });
  const persistedDraft = useRef<Draft>({ title: '', body: '', tags: [] });
  const saveGeneration = useRef(0);

  useEffect(() => {
    latestDraft.current = { title, body, tags };
  }, [body, tags, title]);

  useEffect(() => {
    if (!entry) return;
    persistedDraft.current = { title: entry.title, body: entry.body, tags: entry.tags };
    if (hydratedEntryId.current === entry.id) return;
    hydratedEntryId.current = entry.id;
    latestDraft.current = { title: entry.title, body: entry.body, tags: entry.tags };
    setTitle(entry.title);
    setBody(entry.body);
    setTags(entry.tags);
    setCalendarMonth(monthStartForDate(entry.localDate));
    setSaveState('saved');
  }, [entry]);

  const save = useCallback(
    async (snapshot = latestDraft.current) => {
      if (!entryId || hydratedEntryId.current !== entryId) return false;
      if (sameDraft(snapshot, persistedDraft.current)) {
        setSaveState('saved');
        return true;
      }

      const generation = ++saveGeneration.current;
      setSaveState('saving');
      try {
        const updated = await updateEntry({
          entryId,
          title: snapshot.title,
          body: snapshot.body,
          tags: snapshot.tags,
        });
        persistedDraft.current = {
          title: updated.title,
          body: updated.body,
          tags: updated.tags,
        };
        if (generation === saveGeneration.current) {
          setSaveState(sameDraft(latestDraft.current, snapshot) ? 'saved' : 'unsaved');
        }
        return true;
      } catch {
        if (generation === saveGeneration.current) setSaveState('error');
        return false;
      }
    },
    [entryId, updateEntry],
  );

  useEffect(() => {
    if (!entry || hydratedEntryId.current !== entry.id) return;
    const snapshot = { title, body, tags };
    if (sameDraft(snapshot, persistedDraft.current)) {
      setSaveState('saved');
      return;
    }
    setSaveState('unsaved');
    const timer = setTimeout(() => {
      void save(snapshot);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [body, entry, save, tags, title]);

  const closeEditor = useCallback(async () => {
    const snapshot = latestDraft.current;
    if (!snapshot.title.trim() && !snapshot.body.trim() && !(photos?.length ?? 0)) {
      try {
        await removeEntry({ entryId });
      } catch {
        // Blank drafts never appear in the timeline and can be safely retried later.
      }
      router.back();
      return;
    }

    const saved = await save(snapshot);
    if (!saved) {
      Alert.alert(
        'This entry is not saved yet',
        'Keep this screen open and try again when your connection returns.',
      );
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Journal entry saved.');
    }
    router.back();
  }, [entryId, photos?.length, removeEntry, save]);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().replace(/\s+/g, ' ');
    if (!tag) return;
    if (tag.length > 30) {
      Alert.alert('That tag is too long', 'Keep tags to 30 characters or fewer.');
      return;
    }
    if (tags.length >= 10) {
      Alert.alert('Tag limit reached', 'Each entry can have up to 10 tags.');
      return;
    }
    if (!tags.some((current) => current.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      setTags((current) => [...current, tag]);
    }
    setTagInput('');
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  }, [tagInput, tags]);

  const choosePhotos = useCallback(async () => {
    if (photoUploading || (photos?.length ?? 0) >= 10) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photos permission needed',
        'Allow photo access in Settings to add images to this memory.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, 10 - (photos?.length ?? 0)),
      quality: 0.86,
    });
    if (result.canceled) return;

    setPhotoUploading(true);
    try {
      for (const asset of result.assets) {
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const blob = await (await fetch(asset.uri)).blob();
        const uploadUrl = await generatePhotoUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': mimeType },
          body: blob,
        });
        if (!response.ok) throw new Error('The photo upload did not finish.');
        const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
        await addPhoto({
          entryId,
          storageId,
          mimeType,
          ...(asset.fileName ? { fileName: asset.fileName } : {}),
          width: asset.width,
          height: asset.height,
        });
      }
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert(
        'Could not add that photo',
        error instanceof Error ? error.message : 'Try again when your connection returns.',
      );
    } finally {
      setPhotoUploading(false);
    }
  }, [addPhoto, entryId, generatePhotoUploadUrl, photoUploading, photos?.length]);

  const confirmRemovePhoto = useCallback(
    (attachmentId: Id<'journalAttachments'>) => {
      Alert.alert('Remove this photo?', 'The written entry will stay in your journal.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removePhoto({ attachmentId }).catch((error: unknown) => {
              Alert.alert(
                'Could not remove this photo',
                error instanceof Error ? error.message : undefined,
              );
            });
          },
        },
      ]);
    },
    [removePhoto],
  );

  const moveEntryToDate = useCallback(
    async (nextLocalDate: string) => {
      if (!entry) return;
      const previousMoment = new Date(entry.occurredAt);
      const nextMoment = dateFromLocalKey(nextLocalDate);
      nextMoment.setHours(
        previousMoment.getHours(),
        previousMoment.getMinutes(),
        previousMoment.getSeconds(),
        0,
      );
      if (nextMoment.getTime() > Date.now()) nextMoment.setTime(Date.now());
      try {
        await updateEntry({
          entryId,
          localDate: localDateKey(nextMoment),
          occurredAt: nextMoment.getTime(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || entry.timeZone,
        });
        setDateEditing(false);
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
      } catch (error) {
        Alert.alert(
          'Could not change the date',
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [entry, entryId, updateEntry],
  );

  const shareEntry = useCallback(async () => {
    const snapshot = latestDraft.current;
    const saved = await save(snapshot);
    if (!saved || !entry) return;
    await Share.share({
      message: journalShareText({
        localDate: entry.localDate,
        ...snapshot,
      }),
    });
  }, [entry, save]);

  if (entry === undefined) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (entry === null) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText style={styles.notFoundTitle}>This entry is no longer here.</ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.quietButton, { borderColor: theme.border }]}
        >
          <ThemedText type="smallBold">Back to Journal</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const mood = health?.mood
    ? MOODS.find((option) => option.value === health.mood)
    : null;
  const prompt = PROMPTS[health?.mood ?? 'unselected'];

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
          <View style={styles.navigationBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close journal entry"
              onPress={() => void closeEditor()}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <SymbolView
                name="chevron.left"
                size={20}
                tintColor={theme.text}
                fallback={<ThemedText type="smallBold">Back</ThemedText>}
              />
            </Pressable>
            <ThemedText
              accessibilityLiveRegion="polite"
              accessible
              style={styles.saveStatus}
              themeColor={saveState === 'error' ? 'destructive' : 'textSecondary'}
            >
              {saveStateLabel(saveState)}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save and close journal entry"
              onPress={() => void closeEditor()}
              style={({ pressed }) => [
                styles.doneButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              {saveState === 'saving' ? (
                <ActivityIndicator color={theme.primaryForeground} size="small" />
              ) : (
                <SymbolView
                  name="checkmark"
                  size={18}
                  tintColor={theme.primaryForeground}
                  fallback={
                    <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                      Done
                    </ThemedText>
                  }
                />
              )}
            </Pressable>
          </View>

          <View style={styles.dateRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change journal entry date"
              onPress={() => setDateEditing((editing) => !editing)}
              style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
            >
              <SymbolView name="calendar" size={14} tintColor={theme.primary} />
              <ThemedText selectable type="smallBold">
                {formatJournalDate(entry.localDate)}
              </ThemedText>
            </Pressable>
            <ThemedText selectable type="small" themeColor="textSecondary">
              {new Date(entry.occurredAt).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </ThemedText>
            {mood ? (
              <View style={[styles.moodChip, { backgroundColor: mood.softColor }]}>
                <ThemedText style={[styles.moodLabel, { color: '#3D322B' }]}>
                  {mood.label}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {dateEditing ? (
            <JournalCalendar
              days={monthDays}
              monthStart={calendarMonth}
              onChangeMonth={setCalendarMonth}
              onSelectDate={(date) => {
                if (date) void moveEntryToDate(date);
              }}
              selectedDate={entry.localDate}
              today={localDateKey()}
            />
          ) : null}

          <View
            style={[
              styles.promptCard,
              { backgroundColor: theme.secondary },
            ]}
          >
            <View style={styles.promptIcon}>
              <SymbolView
                name="sparkles"
                size={16}
                tintColor={theme.secondaryForeground}
              />
            </View>
            <ThemedText style={{ color: theme.secondaryForeground }}>
              {prompt}
            </ThemedText>
          </View>

          {photos?.length || photoUploading ? (
            <View style={styles.photoSection}>
              <View style={styles.sectionHeadingRow}>
                <ThemedText style={styles.sectionHeading}>Photos</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {photos?.length ?? 0}/10
                </ThemedText>
              </View>
              <ScrollView
                horizontal
                contentContainerStyle={styles.photoStrip}
                showsHorizontalScrollIndicator={false}
              >
                {photos?.map((photo) => (
                  <Pressable
                    key={photo.id}
                    accessibilityRole="button"
                    accessibilityLabel="Remove journal photo"
                    onPress={() => confirmRemovePhoto(photo.id)}
                    style={({ pressed }) => [styles.photoFrame, pressed && styles.pressed]}
                  >
                    <ExpoImage
                      contentFit="cover"
                      source={{ uri: photo.url }}
                      style={styles.photo}
                      transition={160}
                    />
                    <View style={styles.removePhotoBadge}>
                      <SymbolView name="xmark" size={10} tintColor="#FFFFFF" />
                    </View>
                  </Pressable>
                ))}
                {photoUploading ? (
                  <View
                    style={[
                      styles.photoFrame,
                      styles.photoLoading,
                      { backgroundColor: theme.backgroundElement },
                    ]}
                  >
                    <ActivityIndicator color={theme.primary} />
                  </View>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          <View
            style={[
              styles.editor,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <TextInput
              accessibilityLabel="Journal entry title"
              maxLength={TITLE_MAX_LENGTH}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={theme.textSecondary}
              selectionColor="#D89B21"
              style={[styles.titleInput, { color: theme.text }]}
              value={title}
            />
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            <TextInput
              accessibilityLabel="Journal entry"
              maxLength={BODY_MAX_LENGTH}
              multiline
              onChangeText={setBody}
              placeholder="Write without polishing it…"
              placeholderTextColor={theme.textSecondary}
              selectionColor="#D89B21"
              style={[styles.bodyInput, { color: theme.text }]}
              textAlignVertical="top"
              value={body}
            />
          </View>

          <View
            style={[
              styles.metadataCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.sectionHeadingRow}>
              <View style={styles.metadataTitle}>
                <View style={styles.honeyIcon}>
                  <SymbolView name="number" size={14} tintColor="#6D4B0D" />
                </View>
                <ThemedText style={styles.sectionHeading}>Tags</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {tags.length}/10
              </ThemedText>
            </View>
            {tags.length ? (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <Pressable
                    key={tag}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${tag} tag`}
                    onPress={() => setTags((current) => current.filter((item) => item !== tag))}
                    style={({ pressed }) => [
                      styles.tag,
                      { backgroundColor: theme.backgroundElement },
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText type="smallBold">#{tag}</ThemedText>
                    <SymbolView name="xmark" size={9} tintColor={theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={[styles.tagField, { borderColor: theme.border }]}>
              <TextInput
                accessibilityLabel="New journal tag"
                maxLength={30}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                placeholder="Add a tag"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                selectionColor="#D89B21"
                style={[styles.tagInput, { color: theme.text }]}
                value={tagInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add journal tag"
                disabled={!tagInput.trim()}
                onPress={addTag}
                style={({ pressed }) => [
                  styles.addTagButton,
                  !tagInput.trim() && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView name="plus.circle.fill" size={22} tintColor={theme.primary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.toolbar}>
            <EditorAction
              busy={photoUploading}
              disabled={(photos?.length ?? 0) >= 10}
              icon="photo"
              label="Photo"
              onPress={() => void choosePhotos()}
            />
            <EditorAction
              icon={entry.isFavorite ? 'heart.fill' : 'heart'}
              label={entry.isFavorite ? 'Loved' : 'Favorite'}
              onPress={() => void updateEntry({ entryId, isFavorite: !entry.isFavorite })}
            />
            <EditorAction
              icon="square.and.arrow.up"
              label="Share"
              onPress={() => void shareEntry()}
            />
          </View>

          <View style={styles.footer}>
            <ThemedText selectable type="small" themeColor="textSecondary">
              {body.length.toLocaleString()} characters
            </ThemedText>
            {saveState === 'error' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void save()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <ThemedText type="smallBold" themeColor="destructive">
                  Try saving again
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function EditorAction({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarAction,
        { backgroundColor: theme.card, borderColor: theme.border },
        (busy || disabled) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.primary} size="small" />
      ) : (
        <SymbolView name={icon} size={17} tintColor={theme.primary} />
      )}
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function sameDraft(left: Draft, right: Draft) {
  return (
    left.title === right.title &&
    left.body === right.body &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}

function saveStateLabel(state: SaveState) {
  switch (state) {
    case 'loading':
      return 'Loading…';
    case 'saving':
      return 'Saving…';
    case 'unsaved':
      return 'Unsaved changes';
    case 'error':
      return 'Couldn’t save';
    default:
      return 'Saved';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  navigationBar: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  doneButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  saveStatus: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
  },
  dateRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dateButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingRight: Spacing.two,
  },
  moodChip: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  moodLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  promptCard: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  promptIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  photoSection: {
    gap: Spacing.two,
  },
  sectionHeadingRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionHeading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 700,
  },
  photoStrip: {
    gap: Spacing.two,
  },
  photoFrame: {
    width: 164,
    height: 116,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBadge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(20, 20, 20, 0.72)',
  },
  editor: {
    minHeight: 460,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  titleInput: {
    minHeight: 52,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    paddingVertical: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  bodyInput: {
    minHeight: 350,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: 500,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  metadataCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  metadataTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  honeyIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderCurve: 'continuous',
    backgroundColor: '#FFF0C2',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },
  tagField: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
  },
  tagInput: {
    minHeight: 44,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 500,
  },
  addTagButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  toolbar: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toolbarAction: {
    minHeight: 52,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.one,
  },
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  quietButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  notFoundTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
