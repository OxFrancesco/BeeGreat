import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

/** Renders the agent's `beeui` spec as native cards streaming in below the pill. */
export function GeneratedUI({ components }: { components: UIComponent[] }) {
  if (components.length === 0) return null;
  return (
    <View style={styles.stack}>
      {components.map((component, index) => (
        <Animated.View key={index} entering={FadeInDown.delay(index * 80).springify().damping(18)}>
          <UIComponentView component={component} />
        </Animated.View>
      ))}
    </View>
  );
}

function UIComponentView({ component }: { component: UIComponent }) {
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
    case 'confirm':
      return <ConfirmCard {...component} />;
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
          <View key={point.label} style={styles.chartRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chartLabel}>
              {point.label}
            </ThemedText>
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
  return (
    <Card>
      <ThemedText type="smallBold">{title}</ThemedText>
      <View style={styles.taskList}>
        {items.map((item) => (
          <View key={item.id} style={styles.taskRow}>
            <SymbolView
              name={item.done ? 'checkmark.circle.fill' : 'circle'}
              size={18}
              tintColor={item.done ? theme.primary : theme.textSecondary}
              fallback={
                <ThemedText type="small" themeColor="textSecondary">
                  {item.done ? '[x]' : '[ ]'}
                </ThemedText>
              }
            />
            <ThemedText
              style={[styles.taskTitle, item.done && styles.taskDone]}
              themeColor={item.done ? 'textSecondary' : 'text'}
            >
              {item.title}
            </ThemedText>
            {item.due ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.due}
              </ThemedText>
            ) : null}
          </View>
        ))}
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

function ConfirmCard({ summary }: { summary: string; action: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.destructive }]}>
      <ThemedText type="smallBold" themeColor="destructive">
        Needs your confirmation
      </ThemedText>
      <ThemedText>{summary}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Reply yes or no by voice or text.
      </ThemedText>
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
    gap: Spacing.two,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chartLabel: {
    width: 72,
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
