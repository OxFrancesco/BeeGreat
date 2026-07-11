import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { FirstFocusPreviewCard } from '@/components/first-focus/first-focus-preview-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

/** Renders the agent's `beeui` spec as native cards streaming in below the pill. */
export function GeneratedUI({
  components,
  onReply,
}: {
  components: UIComponent[];
  /** Sends a message back to the agent (used by interactive cards). */
  onReply?: (text: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  if (components.length === 0) return null;
  return (
    <View style={styles.stack}>
      {components.map((component, index) => (
        <Animated.View
          key={index}
          entering={
            reducedMotion
              ? undefined
              : FadeInDown.delay(index * 80)
                  .springify()
                  .damping(18)
          }
        >
          <UIComponentView component={component} onReply={onReply} />
        </Animated.View>
      ))}
    </View>
  );
}

function UIComponentView({
  component,
  onReply,
}: {
  component: UIComponent;
  onReply?: (text: string) => void;
}) {
  switch (component.type) {
    case 'text':
      return <ThemedText>{component.body}</ThemedText>;
    case 'metric':
      return <MetricCard {...component} />;
    case 'chart':
      return <BarChartCard {...component} />;
    case 'tasks':
      return <TaskListCard {...component} />;
    case 'highlight':
      return <HighlightCard {...component} />;
    case 'first_focus':
      return <FirstFocusPreviewCard preview={component} />;
    case 'confirm':
      return <ConfirmCard {...component} onReply={onReply} />;
  }
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {children}
    </View>
  );
}

function MetricCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.metricRow}>
        <ThemedText type="subtitle">{value}</ThemedText>
        {delta ? (
          <ThemedText type="smallBold" themeColor="textSecondary">
            {delta}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

function BarChartCard({
  title,
  unit,
  data,
}: {
  title: string;
  unit?: string;
  data: { label: string; value: number }[];
}) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.chart}>
        {data.map((point) => (
          <View key={point.label} style={styles.chartItem}>
            {/* Label sits above the bar so long goal names never truncate. */}
            <ThemedText type="small" themeColor="textSecondary">
              {point.label}
            </ThemedText>
            <View style={styles.chartRow}>
              <View style={[styles.chartTrack, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[
                    styles.chartFill,
                    {
                      backgroundColor: theme.primary,
                      width: `${Math.max((point.value / max) * 100, 2)}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText type="small" style={styles.chartValue}>
                {point.value}
                {unit ? ` ${unit}` : ''}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TaskListCard({
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
    taskIds: items.map((item) => item.id),
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
          const liveStatus = liveById.get(item.id);
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
              style={({ pressed }) => [styles.taskRow, pressed && styles.taskRowPressed]}
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
              <ThemedText
                style={[styles.taskTitle, done && styles.taskDone]}
                themeColor={done ? 'textSecondary' : 'text'}
              >
                {item.title}
              </ThemedText>
              {item.due ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.due}
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function HighlightCard({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        styles.highlight,
        { backgroundColor: theme.secondary, borderColor: theme.secondary },
      ]}
    >
      <ThemedText type="smallBold" themeColor="secondaryForeground">
        {title}
      </ThemedText>
      <ThemedText themeColor="secondaryForeground">{body}</ThemedText>
    </View>
  );
}

function ConfirmCard({
  summary,
  onReply,
}: {
  summary: string;
  action: string;
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();

  const reply = (text: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply?.(text);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.destructive }]}>
      <ThemedText type="smallBold" themeColor="destructive">
        Needs your confirmation
      </ThemedText>
      <ThemedText>{summary}</ThemedText>
      {onReply ? (
        <View style={styles.confirmRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm"
            onPress={() => reply('Yes')}
            style={({ pressed }) => [
              styles.confirmButton,
              { backgroundColor: theme.primary },
              pressed && styles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              Yes
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline"
            onPress={() => reply('No')}
            style={({ pressed }) => [
              styles.confirmButton,
              styles.confirmButtonOutline,
              { borderColor: theme.border },
              pressed && styles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">No</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Reply yes or no by voice or text.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  chart: {
    gap: Spacing.three,
  },
  chartItem: {
    gap: Spacing.one,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chartTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 6,
  },
  chartValue: {
    minWidth: 48,
    textAlign: 'right',
  },
  taskList: {
    gap: Spacing.two,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskRowPressed: {
    opacity: 0.6,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 20,
  },
  confirmButtonOutline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  taskTitle: {
    flex: 1,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
  highlight: {
    borderWidth: 0,
  },
});
