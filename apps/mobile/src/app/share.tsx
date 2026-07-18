import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useIncomingShare, type ResolvedSharePayload, type SharePayload } from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { normalizeBookmarkInputUrl } from '@/lib/bookmark-url';

type SaveState =
  | { status: 'waiting' | 'saving' }
  | { status: 'saved'; bookmarkId: Id<'bookmarks'> }
  | { status: 'error'; message: string };

function urlFromText(value: string) {
  const exact = value.trim();
  const exactUrl = normalizeBookmarkInputUrl(exact);
  if (exactUrl) return exactUrl;

  // Shared text often contains a title followed by a URL, so try the first link.
  const match = value.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (!match) return null;
  const candidate = match.replace(/[.,;:!?\]}]+$/, '').replace(/\)$/, '');
  return normalizeBookmarkInputUrl(candidate);
}

function sharedUrl(raw: SharePayload[], resolved: ResolvedSharePayload[]) {
  for (const payload of raw) {
    const url = urlFromText(payload.value);
    if (url) return url;
  }
  for (const payload of resolved) {
    const url = urlFromText(payload.contentUri ?? payload.value);
    if (url) return url;
  }
  return null;
}

export default function ShareScreen() {
  const theme = useTheme();
  const addBookmark = useMutation(api.bookmarks.add);
  const {
    sharedPayloads,
    resolvedSharedPayloads,
    clearSharedPayloads,
    isResolving,
    error: shareError,
    refreshSharePayloads,
  } = useIncomingShare();
  const url = useMemo(
    () => sharedUrl(sharedPayloads, resolvedSharedPayloads),
    [resolvedSharedPayloads, sharedPayloads],
  );
  const attemptedUrl = useRef<string | null>(null);
  const [state, setState] = useState<SaveState>({ status: 'waiting' });

  useEffect(() => {
    if (!url || attemptedUrl.current === url) return;
    attemptedUrl.current = url;
    setState({ status: 'saving' });

    void addBookmark({ url })
      .then(async (bookmark) => {
        clearSharedPayloads();
        setState({ status: 'saved', bookmarkId: bookmark._id });
        if (process.env.EXPO_OS === 'ios') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .catch(async (caught) => {
        setState({
          status: 'error',
          message: caught instanceof Error ? caught.message : 'Bee could not save this link.',
        });
        if (process.env.EXPO_OS === 'ios') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      });
  }, [addBookmark, clearSharedPayloads, state.status, url]);

  const retry = () => {
    attemptedUrl.current = null;
    setState({ status: 'waiting' });
    refreshSharePayloads();
  };

  const saved = state.status === 'saved';
  const unresolved = !url && (isResolving || state.status === 'waiting') && !shareError;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
    >
      <View style={[styles.icon, { backgroundColor: saved ? theme.secondary : theme.backgroundElement }]}>
        {unresolved || state.status === 'saving' ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <SymbolView
            name={saved ? 'checkmark' : 'exclamationmark'}
            size={34}
            tintColor={saved ? '#A86A16' : theme.destructive}
          />
        )}
      </View>

      <View style={styles.copy}>
        <ThemedText type="subtitle" style={styles.centered}>
          {saved
            ? 'Saved to Mind'
            : unresolved || state.status === 'saving'
              ? 'Saving to Mind…'
              : 'This link needs a hand'}
        </ThemedText>
        <ThemedText selectable themeColor="textSecondary" style={styles.centered}>
          {saved
            ? 'Bee is gathering the page and will organize it in the background.'
            : state.status === 'error'
              ? state.message
              : shareError?.message ?? 'Share a website, post, or YouTube link for Bee to remember.'}
        </ThemedText>
        {url ? (
          <ThemedText selectable type="small" numberOfLines={2} themeColor="textSecondary" style={styles.url}>
            {url}
          </ThemedText>
        ) : null}
      </View>

      {state.status === 'saved' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(`/mind/${state.bookmarkId}` as Href)}
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              View bookmark
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/mind' as Href)}
            style={({ pressed }) => [
              styles.secondaryAction,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Go to Mind</ThemedText>
          </Pressable>
        </View>
      ) : !unresolved && state.status !== 'saving' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              Try again
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/mind/add' as Href)}
            style={({ pressed }) => [
              styles.secondaryAction,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Paste a link instead</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  icon: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    borderCurve: 'continuous',
  },
  copy: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 10 },
  centered: { textAlign: 'center' },
  url: {
    overflow: 'hidden',
    maxWidth: '100%',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(127,127,127,0.1)',
  },
  actions: { width: '100%', maxWidth: 360, gap: 10 },
  primaryAction: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  secondaryAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  pressed: { opacity: 0.72 },
});
