import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Card } from './shared';

export function BarChartCard({
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
              <View
                style={[
                  styles.chartTrack,
                  { backgroundColor: theme.backgroundElement },
                ]}
              >
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
              <ThemedText selectable type="small" style={styles.chartValue}>
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

const styles = StyleSheet.create({
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
});
