import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
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
import { normalizeBookmarkInputUrl } from '@/lib/bookmark-url';

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
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const normalizedUrl = useMemo(() => normalizeBookmarkInputUrl(url), [url]);

  const pasteLink = async () => {
    try {
      const candidate = normalizeBookmarkInputUrl(await Clipboard.getStringAsync());
      if (!candidate) {
        setError('Your clipboard does not contain a valid domain or link.');
        return;
      }
      setUrl(candidate);
      setError(null);
    } catch {
      setError('Bee could not read the link from your clipboard.');
    }
  };

  const save = async () => {
    if (!normalizedUrl || isSaving) {
      setError('Enter a valid domain or link.');
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
      style={{ backgroundColor: theme.background }}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <ThemedText type="subtitle" style={styles.introTitle}>
            Keep it in Mind
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.introDescription}>
            Bee will read the page, pull out the good parts, and make it easy to find later.
          </ThemedText>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabelRow}>
            <ThemedText type="smallBold">URL</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Paste link from clipboard"
              hitSlop={8}
              onPress={() => void pasteLink()}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                Paste
              </ThemedText>
            </Pressable>
          </View>
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
            placeholder="example.com"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="next"
            style={[
              styles.input,
              styles.urlInput,
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
  content: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  intro: { gap: 4, paddingBottom: 2 },
  introTitle: { fontSize: 27, lineHeight: 32 },
  introDescription: { fontSize: 16, lineHeight: 22, maxWidth: 520 },
  fieldGroup: { gap: 8 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    fontSize: 16,
  },
  // A fixed height with no vertical padding vertically centers single-line text.
  urlInput: { height: 52, paddingVertical: 0 },
  note: { minHeight: 92, paddingVertical: 12 },
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
