import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { Card } from './shared';

export function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <Card>
      <ThemedText selectable type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.metricRow}>
        <ThemedText selectable type="subtitle" style={styles.metricValue}>
          {value}
        </ThemedText>
        {delta ? (
          <ThemedText selectable type="smallBold" themeColor="textSecondary">
            {delta}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metricValue: {
    flexShrink: 1,
  },
});
