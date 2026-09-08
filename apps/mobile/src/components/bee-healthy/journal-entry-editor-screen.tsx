import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import {
  JournalSession,
  formatSaveState,
  type JournalSaveState,
} from '@beegreat/tool-presentation';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { clearJournalEditorDrafts, journalEditorStorage } from '@/lib/journal-editor-storage';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps } from 'react';
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


const PROMPTS = {
  awful: 'What would make today feel one percent gentler?',
  bad: 'What is taking up the most space in your mind?',
  okay: 'What do you want to notice before today passes?',
  good: 'What gave you a little energy today?',
  great: 'What do you want to remember from this feeling?',
  unselected: 'What do you want to remember from today?',
} satisfies Record<Mood | 'unselected', string>;

// Draft comparison and save-state copy are shared with the web editor.
type SaveState = JournalSaveState;

export function JournalEntryEditorScreen() {
  const theme = useTheme();
  const { getToken, userId } = useAuth();
  const { entryId: routeEntryId } = useLocalSearchParams<{ entryId: string }>();
  // SAFETY: This screen is only reached through links built from a Convex
  // journal entry document (`/journal-entry/${entry.id}`), so the route param
  // is an Id<'journalEntries'>.
  const entryId = routeEntryId as Id<'journalEntries'>;
  const entry = useQuery(api.journalEntries.get, entryId ? { entryId } : 'skip');
  const updateEntry = useMutation(api.journalEntries.update);
  const generatePhotoUploadUrl = useMutation(api.journalEntries.generatePhotoUploadUrl);
  const removePhoto = useMutation(api.journalEntries.removePhoto);
  const photos = useQuery(
    api.journalEntries.listPhotos,
    entryId ? { entryId } : 'skip',
  );
  const health = useQuery(
    api.healthJournal.getByDate,
    entry ? { localDate: entry.localDate } : 'skip',
  );

  const convex = useConvex();
  const navigation = useNavigation();
  const session = useMemo(() => new JournalSession({
    persist: (draft, expectedUpdatedAt) => updateEntry({ entryId, expectedUpdatedAt, ...draft }),
    load: () => convex.query(api.journalEntries.get, { entryId }),
    storage: journalEditorStorage(userId ?? '', entryId),
  }), [convex, entryId, updateEntry, userId]);
  const editor = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { title, body, tags } = editor.draft;
  const saveState = editor.status;
  const setTitle = (title: string) => session.edit({ title });
  const setBody = (body: string) => session.edit({ body });
  const setTags = useCallback((value: string[] | ((tags: string[]) => string[])) => session.edit({ tags: typeof value === 'function' ? value(session.getSnapshot().draft.tags) : value }), [session]);
  const save = useCallback(() => session.save(), [session]);
  const [tagInput, setTagInput] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [dateEditing, setDateEditing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    monthStartForDate(localDateKey()),
  );
  const monthDays = useQuery(api.journalEntries.listMonth, {
    monthStart: calendarMonth,
  });
  useEffect(() => {
    if (entry) session.receive(entry);
    else if (entry === null && userId) { clearJournalEditorDrafts(userId, entryId); session.discard(); }
  }, [entry, entryId, session, userId]);

  useEffect(() => {
    if (editor.status !== 'unsaved') return;
    const timer = setTimeout(() => { void session.save(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [editor.draft, editor.status, session]);

  usePreventRemove(true, ({ data }) => {
    void session.save().then(saved => {
      if (saved || !session.getSnapshot().dirty) navigation.dispatch(data.action);
      else Alert.alert('This entry is not saved yet', 'Keep editing to resolve changes or try saving again.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave without saving', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ]);
    });
  });

  const closeEditor = useCallback(async () => {
    if (!(await session.save())) {
      Alert.alert('This entry is not saved yet', 'Resolve changes or try saving again before closing.');
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Journal entry saved.');
    }
    router.back();
  }, [session]);

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
  }, [tagInput, tags, setTags]);

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
        const uploadUrl = new URL(await generatePhotoUploadUrl({}));
        uploadUrl.searchParams.set('entryId', entryId);
        if (asset.fileName) uploadUrl.searchParams.set('fileName', asset.fileName);
        uploadUrl.searchParams.set('width', String(asset.width));
        uploadUrl.searchParams.set('height', String(asset.height));
        const token = await getToken({ template: 'convex' });
        if (!token) throw new Error('Sign in to upload a photo.');
        const response = await fetch(uploadUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': mimeType, Authorization: `Bearer ${token}` },
          body: blob,
        });
        if (!response.ok) throw new Error('The photo upload did not finish. Photos must be at most 10 MB.');
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
  }, [entryId, generatePhotoUploadUrl, getToken, photoUploading, photos?.length]);

  const confirmRemovePhoto = useCallback(
    (attachmentId: Id<'journalAttachments'>) => {
      Alert.alert('Remove this photo?', 'The written entry will stay in your journal.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void removePhoto({ attachmentId }).catch((cause: unknown) => {
              Alert.alert(
                'Could not remove this photo',
                cause instanceof Error ? cause.message : undefined,
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
          expectedUpdatedAt: entry.updatedAt,
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
    const snapshot = session.getSnapshot().draft;
    const saved = await save();
    if (!saved || !entry) return;
    await Share.share({
      message: journalShareText({
        localDate: entry.localDate,
        ...snapshot,
      }),
    });
  }, [entry, save, session]);

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
              onPress={() => void updateEntry({ entryId, expectedUpdatedAt: entry.updatedAt, isFavorite: !entry.isFavorite }).catch(() => Alert.alert('Could not update favorite', 'Try again with the latest entry.'))}
            />
            <EditorAction
              icon="square.and.arrow.up"
              label="Share"
              onPress={() => void shareEntry()}
            />
          </View>

          {editor.error ? <ThemedText type="small" themeColor="destructive" accessibilityLiveRegion="polite">{editor.error}</ThemedText> : null}
          {editor.status === 'conflict' ? <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={() => void session.resolve('reload')} style={styles.retryButton}><ThemedText type="smallBold">Reload saved entry</ThemedText></Pressable>
            <Pressable accessibilityRole="button" onPress={() => void session.resolve('keep')} style={styles.retryButton}><ThemedText type="smallBold">Save my version</ThemedText></Pressable>
          </View> : null}
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

function saveStateLabel(state: SaveState) {
  // Mobile's error copy stays "Couldn’t save"; web says "Not saved".
  return formatSaveState(state, { error: 'Couldn’t save' });
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
