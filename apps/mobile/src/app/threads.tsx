import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  setActiveThread,
  startNewThread,
  useActiveThread,
  useThreads,
} from '@/lib/preferences';

const HONEY = '#FAB52A';

function formatCreatedAt(createdAt: number) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** How many threads fit the sheet; the newest matter most. */
const MAX_VISIBLE_THREADS = 15;

/** Sheet listing recent conversation threads; tap one to jump back into it. */
export default function ThreadsScreen() {
  const theme = useTheme();
  const threads = useThreads();
  const active = useActiveThread();
  // Plain rows instead of a ScrollView: react-native-screens re-anchors
  // scroll views inside formSheets, which breaks the layout.
  const newest = [...threads].sort((a, b) => b.id - a.id).slice(0, MAX_VISIBLE_THREADS);

  const open = (id: number) => {
    setActiveThread(id);
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
        CONVERSATIONS
      </ThemedText>
      <View style={styles.list}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new conversation"
          onPress={() => {
            startNewThread();
            router.back();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <SymbolView
            name="plus.circle.fill"
            size={22}
            tintColor={HONEY}
            fallback={<ThemedText type="smallBold">+</ThemedText>}
          />
          <ThemedText style={styles.rowTitle}>New conversation</ThemedText>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        {newest.map((thread) => (
          <Pressable
            key={thread.id}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation: ${thread.title ?? 'New conversation'}`}
            onPress={() => open(thread.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <SymbolView
              name="hexagon.fill"
              size={14}
              tintColor={thread.id === active ? HONEY : theme.border}
              fallback={
                <ThemedText type="small" themeColor="textSecondary">
                  ⬡
                </ThemedText>
              }
            />
            <View style={styles.rowBody}>
              <ThemedText numberOfLines={1} style={styles.rowTitle}>
                {thread.title ?? 'New conversation'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatCreatedAt(thread.createdAt)}
                {thread.id === active ? ' · Current' : ''}
              </ThemedText>
            </View>
            {thread.id === active ? (
              <SymbolView
                name="checkmark"
                size={14}
                tintColor={HONEY}
                fallback={<ThemedText type="smallBold">✓</ThemedText>}
              />
            ) : null}
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  heading: {
    marginBottom: Spacing.two,
  },
  list: {
    paddingBottom: Spacing.five,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTitle: {
    flexShrink: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
});
