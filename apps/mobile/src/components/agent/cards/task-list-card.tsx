import { platformSymbol } from '@/components/platform-symbol';
import { useTaskUpdates } from '@/hooks/use-task-updates';
import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Card, sharedStyles } from './shared';

export function TaskListCard({
  title,
  items,
}: {
  title: string;
  items: { id: string; title: string; done: boolean; due?: string }[];
}) {
  // The card is a snapshot from the agent; overlay live Convex state so rows
  // stay in sync with the Goals pages and stay tappable to complete tasks.
  const live = useQuery(api.tasks.statuses, {
    taskIds: items.map((item) => item.id),
  });
  const toggle = useMutation(api.tasks.toggle);
  const liveById = new Map<string, NonNullable<typeof live>[number]>(
    live?.map((task) => [task.id, task]),
  );

  return (
    <TaskListCardView
      title={title}
      items={items.map((item) => ({
        ...item,
        done:
          liveById.get(item.id)?.status === 'done' ||
          (!liveById.has(item.id) && item.done),
      }))}
      onToggle={(id) => {
        const task = liveById.get(id);
        if (!task) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return toggle({ taskId: task.id });
      }}
      interactiveIds={new Set(liveById.keys())}
    />
  );
}

export function TaskListCardView({
  title,
  items,
  onToggle,
  interactiveIds,
  loading = false,
}: {
  title: string;
  items: { id: string; title: string; done: boolean; due?: string }[];
  onToggle: (id: string) => unknown | Promise<unknown>;
  loading?: boolean;
  interactiveIds?: Set<string>;
}) {
  const theme = useTheme();
  const updates = useTaskUpdates();
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.taskList}>
        {loading ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Loading tasks"
            style={styles.taskRow}
          >
            <ActivityIndicator color={theme.primary} />
            <ThemedText>Loading tasks…</ThemedText>
          </View>
        ) : null}
        {!loading && items.length === 0 ? (
          <ThemedText themeColor="textSecondary">No tasks yet.</ThemedText>
        ) : null}
        {items.map((item) => {
          const done = item.done;
          const state = updates.states[item.id];
          const pending = state === 'pending';
          // Only rows backed by a real task are interactive.
          const interactive = !interactiveIds || interactiveIds.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: done,
                disabled: !interactive || pending,
                busy: pending,
              }}
              accessibilityLabel={
                state === 'failed' ? `Retry updating ${item.title}` : item.title
              }
              disabled={!interactive || pending}
              onPress={() => void updates.run(item.id, () => onToggle(item.id))}
              style={({ pressed }) => [
                styles.taskRow,
                pressed && sharedStyles.taskRowPressed,
              ]}
            >
              {pending ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <SymbolView
                  name={platformSymbol(
                    done ? 'checkmark.circle.fill' : 'circle',
                  )}
                  size={18}
                  tintColor={done ? theme.primary : theme.textSecondary}
                />
              )}
              <View style={styles.taskBody}>
                <ThemedText
                  style={[styles.taskTitle, done && styles.taskDone]}
                  themeColor={done ? 'textSecondary' : 'text'}
                >
                  {item.title}
                </ThemedText>
                {state ? (
                  <ThemedText
                    accessibilityLiveRegion="polite"
                    type="small"
                    themeColor={
                      state === 'failed' ? 'destructive' : 'textSecondary'
                    }
                  >
                    {pending ? 'Saving…' : 'Could not save. Tap to retry.'}
                  </ThemedText>
                ) : null}
                {item.due ? (
                  <ThemedText
                    selectable
                    type="small"
                    themeColor="textSecondary"
                  >
                    {item.due}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  taskList: {
    gap: Spacing.two,
  },
  taskRow: {
    minHeight: 48,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  taskTitle: {
    flexShrink: 1,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
});
