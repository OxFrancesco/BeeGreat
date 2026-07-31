import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useActiveChatThread,
  useChatThreadActions,
  useChatThreads,
  type ChatThread,
} from '@/hooks/use-convex-chat';
import { useScreenshotFixture } from '@/lib/screenshot-fixture';

const HONEY = '#FAB52A';

function formatCreatedAt(createdAt: number) {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Sheet listing recent conversation threads; tap one to jump back into it. */
export default function ThreadsScreen() {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return (
      <ThreadsScreenView
        threads={fixture.threads}
        active={fixture.activeThread}
        activateThread={async () => {}}
        createThread={async () => 0}
        setThreadArchived={async () => {}}
      />
    );
  }
  return <ConnectedThreadsScreen />;
}

function ConnectedThreadsScreen() {
  const threads = useChatThreads();
  const active = useActiveChatThread();
  const { activateThread, createThread, setThreadArchived } = useChatThreadActions();
  return (
    <ThreadsScreenView
      threads={threads}
      active={active}
      activateThread={activateThread}
      createThread={createThread}
      setThreadArchived={setThreadArchived}
    />
  );
}

function ThreadsScreenView({
  threads,
  active,
  activateThread,
  createThread,
  setThreadArchived,
}: {
  threads: ChatThread[];
  active: number;
  activateThread: (threadId: number) => Promise<unknown>;
  createThread: () => Promise<unknown>;
  setThreadArchived: (threadId: number, archived: boolean) => Promise<unknown>;
}) {
  const theme = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const newest = [...threads].sort((a, b) => b.id - a.id);
  const current = newest.filter((thread) => !thread.archivedAt);
  const archived = newest.filter((thread) => thread.archivedAt);

  const open = async (id: number) => {
    await activateThread(id);
    router.back();
  };

  const confirmArchive = (thread: ChatThread) => {
    const isArchived = Boolean(thread.archivedAt);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(thread.title ?? 'New conversation', undefined, [
      {
        text: isArchived ? 'Unarchive' : 'Archive',
        onPress: () => void setThreadArchived(thread.id, !isArchived),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderThread = (thread: ChatThread) => (
    <Pressable
      key={thread.id}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation: ${thread.title ?? 'New conversation'}`}
      accessibilityHint={
        thread.archivedAt ? 'Long press to unarchive' : 'Long press to archive'
      }
      onPress={() => open(thread.id)}
      onLongPress={() => confirmArchive(thread)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <SymbolView
        name={thread.source === 'imessage' ? 'message.fill' : 'hexagon.fill'}
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
          {thread.source === 'imessage' ? 'iMessage · ' : ''}
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
  );

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
        {current.map(renderThread)}
        {archived.length > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${showArchived ? 'Hide' : 'Show'} archived conversations`}
              accessibilityState={{ expanded: showArchived }}
              onPress={() => setShowArchived((visible) => !visible)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <SymbolView
                name="archivebox.fill"
                size={14}
                tintColor={theme.textSecondary}
                fallback={
                  <ThemedText type="small" themeColor="textSecondary">
                    ▤
                  </ThemedText>
                }
              />
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                style={styles.rowTitle}
              >
                Archived ({archived.length})
              </ThemedText>
              <SymbolView
                name={showArchived ? 'chevron.up' : 'chevron.down'}
                size={12}
                tintColor={theme.textSecondary}
                fallback={
                  <ThemedText type="small" themeColor="textSecondary">
                    {showArchived ? '▴' : '▾'}
                  </ThemedText>
                }
              />
            </Pressable>
            {showArchived ? archived.map(renderThread) : null}
          </>
        ) : null}
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
