import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useActiveChatThread,
  useChatThreadActions,
  useChatThreads,
} from '@/hooks/use-convex-chat';

const HONEY = '#FAB52A';

function formatCreatedAt(createdAt: number) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Sheet listing recent conversation threads; tap one to jump back into it. */
export default function ThreadsScreen() {
  const theme = useTheme();
  const threads = useChatThreads();
  const active = useActiveChatThread();
  const { activateThread, createThread } = useChatThreadActions();
  const newest = [...threads].sort((a, b) => b.id - a.id);

  const open = async (id: number) => {
    await activateThread(id);
    router.back();
  };

  return (
    // collapsable={false} keeps this wrapper in the native tree so the form
    // sheet can find the ScrollView (react-native-screens#2424).
    <ThemedView style={styles.container} collapsable={false}>
      {/* Drag-to-dismiss can be flaky with a ScrollView inside a formSheet,
          so the sheet always offers an explicit close button. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close conversations"
        hitSlop={Spacing.two}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <SymbolView
          name="xmark"
          size={13}
          tintColor={theme.textSecondary}
          fallback={
            <ThemedText type="small" themeColor="textSecondary">
              ✕
            </ThemedText>
          }
        />
      </Pressable>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heading}>
        CONVERSATIONS
      </ThemedText>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new conversation"
          onPress={async () => {
            await createThread();
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  close: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
