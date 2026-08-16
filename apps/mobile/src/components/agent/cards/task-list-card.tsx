import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

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
  const theme = useTheme();
  // The card is a snapshot from the agent; overlay live Convex state so rows
  // stay in sync with the Goals pages and stay tappable to complete tasks.
  const live = useQuery(api.tasks.statuses, {
    taskIds: items.map((item) => item.id as Id<'tasks'>),
  });
  const toggle = useMutation(api.tasks.toggle);
  const liveById = new Map(live?.map((task) => [task.id, task.status]));

  const onToggle = async (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggle({ taskId: taskId as Id<'tasks'> });
    } catch {
      // Row simply stays as-is; the live query is the source of truth.
    }
  };

  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.taskList}>
        {items.map((item) => {
          const liveStatus = liveById.get(item.id as Id<'tasks'>);
          const done = liveStatus ? liveStatus === 'done' : item.done;
          // Only rows backed by a real task are interactive.
          const interactive = liveStatus !== undefined;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done, disabled: !interactive }}
              accessibilityLabel={item.title}
              disabled={!interactive}
              onPress={() => onToggle(item.id)}
              style={({ pressed }) => [
                styles.taskRow,
                pressed && sharedStyles.taskRowPressed,
              ]}
            >
              <SymbolView
                name={done ? 'checkmark.circle.fill' : 'circle'}
                size={18}
                tintColor={done ? theme.primary : theme.textSecondary}
                fallback={
                  <ThemedText type="small" themeColor="textSecondary">
                    {done ? '[x]' : '[ ]'}
                  </ThemedText>
                }
              />
              <View style={styles.taskBody}>
                <ThemedText
                  style={[styles.taskTitle, done && styles.taskDone]}
                  themeColor={done ? 'textSecondary' : 'text'}
                >
                  {item.title}
                </ThemedText>
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
