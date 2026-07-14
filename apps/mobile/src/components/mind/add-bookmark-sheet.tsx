import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function AddBookmarkSheet({
  initialUrl = '',
  onSaved,
}: {
  initialUrl?: string;
  onSaved: (bookmarkId: Id<'bookmarks'>) => void;
}) {
  const theme = useTheme();
  const addBookmark = useMutation(api.bookmarks.add);
  const [url, setUrl] = useState(initialUrl);
  const [note, setNote] = useState('');
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const normalizedUrl = useMemo(() => normalizeHttpUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const hasText = await Clipboard.hasStringAsync();
      if (!hasText) return;
      const candidate = normalizeHttpUrl(await Clipboard.getStringAsync());
      if (!cancelled && candidate && candidate !== normalizeHttpUrl(initialUrl)) {
        setClipboardUrl(candidate);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialUrl]);

  const save = async () => {
    if (!normalizedUrl || isSaving) {
      setError('Enter a complete http or https link.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const bookmark = await addBookmark({
        url: normalizedUrl,
        note: note.trim() || undefined,
      });
      if (process.env.EXPO_OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onSaved(bookmark._id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bee could not save this link.');
      if (process.env.EXPO_OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // collapsable={false} keeps this wrapper in the native tree so the form
    // sheet can find the ScrollView (react-native-screens#2424).
    <KeyboardAvoidingView
      collapsable={false}
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <View style={[styles.mark, { backgroundColor: theme.secondary }]}>
            <ThemedText style={styles.markText}>✦</ThemedText>
          </View>
          <View style={styles.introCopy}>
            <ThemedText type="subtitle">Keep it in Mind</ThemedText>
            <ThemedText themeColor="textSecondary">
              Bee will read the page, pull out the good parts, and make it easy to find later.
            </ThemedText>
          </View>
        </View>

        {clipboardUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use link from clipboard"
            onPress={() => {
              setUrl(clipboardUrl);
              setClipboardUrl(null);
              setError(null);
            }}
            style={({ pressed }) => [
              styles.clipboard,
              { backgroundColor: theme.secondary },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.clipboardCopy}>
              <ThemedText type="smallBold">Link on your clipboard</ThemedText>
              <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
                {clipboardUrl}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">Use</ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.fieldGroup}>
          <ThemedText type="smallBold">URL</ThemedText>
          <TextInput
            accessibilityLabel="Bookmark URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={(value) => {
              setUrl(value);
              setError(null);
            }}
            onSubmitEditing={() => void save()}
            placeholder="https://example.com"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="next"
            style={[
              styles.input,
              {
                backgroundColor: theme.card,
                borderColor: error && !normalizedUrl ? theme.destructive : theme.border,
                color: theme.text,
              },
            ]}
            value={url}
          />
        </View>

        <View style={styles.fieldGroup}>
          <ThemedText type="smallBold">A note for future you</ThemedText>
          <TextInput
            accessibilityLabel="Optional bookmark note"
            multiline
            onChangeText={setNote}
            placeholder="Why are you saving this? (optional)"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              styles.note,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
            textAlignVertical="top"
            value={note}
          />
        </View>

        {error ? (
          <ThemedText selectable type="small" style={{ color: theme.destructive }}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save bookmark to Mind"
          accessibilityState={{ disabled: !normalizedUrl || isSaving, busy: isSaving }}
          disabled={!normalizedUrl || isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: theme.primary },
            (!normalizedUrl || isSaving) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              Save to Mind
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: 22, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  introCopy: { flex: 1, gap: 3 },
  mark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  markText: { color: '#A86A16', fontSize: 26 },
  clipboard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clipboardCopy: { flex: 1 },
  fieldGroup: { gap: 8 },
  input: {
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  note: { minHeight: 108 },
  save: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.74 },
});
