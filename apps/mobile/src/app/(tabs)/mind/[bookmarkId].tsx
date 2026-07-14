import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const KIND_DETAILS = {
  website: { label: 'Website', symbol: 'safari.fill' },
  tweet: { label: 'Post', symbol: 'bubble.left.and.bubble.right.fill' },
  youtube: { label: 'Video', symbol: 'play.fill' },
} as const;

function displayHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function BookmarkDetailScreen() {
  const { bookmarkId } = useLocalSearchParams<{ bookmarkId: string }>();
  const id = bookmarkId as Id<'bookmarks'>;
  const bookmark = useQuery(api.bookmarks.get, { bookmarkId: id });
  const updateBookmark = useMutation(api.bookmarks.update);
  const removeBookmark = useMutation(api.bookmarks.remove);
  const retryBookmark = useMutation(api.bookmarks.retry);
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!bookmark || dirty.current) return;
    setTitle(bookmark.title ?? '');
    setNote(bookmark.note ?? '');
  }, [bookmark]);

  if (bookmark === undefined) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (bookmark === null) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="subtitle">This thought flew away.</ThemedText>
        <ThemedText themeColor="textSecondary">The bookmark no longer exists.</ThemedText>
      </View>
    );
  }

  const details = KIND_DETAILS[bookmark.kind];
  const isWorking = bookmark.status === 'pending' || bookmark.status === 'processing';
  const hasEdits = title.trim() !== (bookmark.title ?? '') || note.trim() !== (bookmark.note ?? '');

  const saveMetadata = async () => {
    if (!hasEdits || isSaving) return;
    setIsSaving(true);
    try {
      const updated = await updateBookmark({ bookmarkId: bookmark._id, title, note });
      setTitle(updated.title ?? '');
      setNote(updated.note ?? '');
      dirty.current = false;
      if (process.env.EXPO_OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Could not save changes', error instanceof Error ? error.message : undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLabels = async (labels: string[]) => {
    try {
      await updateBookmark({ bookmarkId: bookmark._id, labels });
    } catch (error) {
      Alert.alert('Could not update labels', error instanceof Error ? error.message : undefined);
    }
  };

  const addLabel = () => {
    const label = newLabel.trim().toLowerCase();
    if (!label || bookmark.labels.includes(label)) {
      setNewLabel('');
      return;
    }
    setNewLabel('');
    void updateLabels([...bookmark.labels, label]);
  };

  const retry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await retryBookmark({ bookmarkId: bookmark._id });
      if (process.env.EXPO_OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      Alert.alert('Could not retry', error instanceof Error ? error.message : undefined);
    } finally {
      setIsRetrying(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete this bookmark?', 'It will be removed from your Mind for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void removeBookmark({ bookmarkId: bookmark._id })
            .then(() => router.back())
            .catch((error: unknown) =>
              Alert.alert('Could not delete', error instanceof Error ? error.message : undefined),
            );
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.hero, { backgroundColor: theme.secondary }]}>
          {bookmark.meta?.imageUrl ? (
            <Image source={bookmark.meta.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <SymbolView name={details.symbol} size={56} tintColor="#A86A16" />
          )}
          <View style={styles.heroShade} />
          <View style={styles.kindBadge}>
            <SymbolView name={details.symbol} size={14} tintColor="#582D1D" />
            <ThemedText type="smallBold" style={styles.kindText}>
              {details.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.heading}>
          <TextInput
            accessibilityLabel="Bookmark title"
            multiline
            onChangeText={(value) => {
              dirty.current = true;
              setTitle(value);
            }}
            placeholder={isWorking ? 'Gathering this thought…' : displayHost(bookmark.url)}
            placeholderTextColor={theme.textSecondary}
            style={[styles.titleInput, { color: theme.text }]}
            value={title}
          />
          <ThemedText selectable type="small" themeColor="textSecondary">
            {bookmark.meta?.handle
              ? `@${bookmark.meta.handle}`
              : bookmark.meta?.author ?? bookmark.meta?.siteName ?? displayHost(bookmark.url)}
          </ThemedText>
        </View>

        {isWorking ? (
          <StatusCard message="Bee is reading, summarizing, and labeling this in the background." />
        ) : bookmark.status === 'failed' ? (
          <View style={[styles.failure, { borderColor: theme.destructive }]}>
            <ThemedText type="smallBold" style={{ color: theme.destructive }}>
              Bee could not finish gathering this one
            </ThemedText>
            <ThemedText selectable type="small" themeColor="textSecondary">
              {bookmark.errorMessage ?? 'The source did not respond. You can try again.'}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: isRetrying }}
              onPress={() => void retry()}
              style={({ pressed }) => [
                styles.retry,
                { backgroundColor: theme.secondary },
                pressed && styles.pressed,
              ]}
            >
              {isRetrying ? <ActivityIndicator color="#582D1D" /> : <ThemedText type="smallBold">Try again</ThemedText>}
            </Pressable>
          </View>
        ) : null}

        {bookmark.summary ? (
          <Section title="In a nutshell">
            <ThemedText selectable>{bookmark.summary}</ThemedText>
          </Section>
        ) : null}

        <Section title="Labels">
          <View style={styles.labels}>
            {bookmark.labels.map((label) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Remove label ${label}`}
                onPress={() => void updateLabels(bookmark.labels.filter((item) => item !== label))}
                style={({ pressed }) => [
                  styles.label,
                  { backgroundColor: theme.secondary },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold">{label}</ThemedText>
                <ThemedText type="small">×</ThemedText>
              </Pressable>
            ))}
            <View style={[styles.labelInputWrap, { borderColor: theme.border }]}>
              <TextInput
                accessibilityLabel="New label"
                autoCapitalize="none"
                onChangeText={setNewLabel}
                onSubmitEditing={addLabel}
                placeholder="Add label"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                style={[styles.labelInput, { color: theme.text }]}
                value={newLabel}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add label"
                disabled={!newLabel.trim()}
                hitSlop={8}
                onPress={addLabel}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">＋</ThemedText>
              </Pressable>
            </View>
          </View>
        </Section>

        <Section title="Your note">
          <TextInput
            accessibilityLabel="Bookmark note"
            multiline
            onChangeText={(value) => {
              dirty.current = true;
              setNote(value);
            }}
            placeholder="Add why this matters to you…"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.note,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={note}
          />
        </Section>

        {hasEdits ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isSaving }}
            onPress={() => void saveMetadata()}
            style={({ pressed }) => [
              styles.saveChanges,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                Save changes
              </ThemedText>
            )}
          </Pressable>
        ) : null}

        {bookmark.content ? (
          <Section title={bookmark.kind === 'youtube' ? 'Transcript' : 'Full content'}>
            {bookmark.kind === 'youtube' && bookmark.transcriptSource ? (
              <ThemedText type="small" themeColor="textSecondary">
                {bookmark.transcriptSource === 'captions'
                  ? 'Transcript from video captions'
                  : 'Transcript created with ElevenLabs Scribe'}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showContent }}
              onPress={() => setShowContent((visible) => !visible)}
              style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
            >
              <ThemedText type="smallBold">{showContent ? 'Hide' : 'Read the full text'}</ThemedText>
              <SymbolView
                name={showContent ? 'chevron.up' : 'chevron.down'}
                size={13}
                tintColor={theme.textSecondary}
              />
            </Pressable>
            {showContent ? <ThemedText selectable>{bookmark.content}</ThemedText> : null}
          </Section>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(bookmark.url)}
            style={({ pressed }) => [
              styles.open,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              Open original
            </ThemedText>
            <SymbolView name="arrow.up.right" size={14} tintColor={theme.primaryForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.delete,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.destructive }}>
              Delete bookmark
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

function StatusCard({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.status, { backgroundColor: theme.secondary }]}>
      <ActivityIndicator color="#A86A16" />
      <ThemedText type="small" style={styles.statusCopy}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  content: { gap: 24, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 44 },
  hero: {
    height: 220,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderCurve: 'continuous',
  },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(26,14,4,0.12)',
  },
  kindBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,239,214,0.94)',
  },
  kindText: { color: '#582D1D' },
  heading: { gap: 4 },
  titleInput: { padding: 0, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  section: { gap: 10 },
  status: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 14,
  },
  statusCopy: { flex: 1, color: '#582D1D' },
  failure: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 14,
  },
  retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  labelInputWrap: {
    minHeight: 44,
    minWidth: 126,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  labelInput: { minWidth: 78, flex: 1, paddingVertical: 7, fontSize: 14 },
  note: {
    minHeight: 108,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 13,
    fontSize: 16,
    lineHeight: 23,
  },
  saveChanges: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  disclosure: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { gap: 10, paddingTop: 4 },
  open: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  delete: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.7 },
});
