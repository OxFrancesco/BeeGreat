import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Shimmer } from '@/components/agent/shimmer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getToolCopy, type ToolActivityState } from '@/lib/tool-labels';

/**
 * Quiet, human-readable trace of what the agent is doing. Tool internals
 * (names, inputs, outputs) are deliberately never shown to the user.
 */
export function ToolActivity({ name, state }: { name: string; state: ToolActivityState }) {
  const theme = useTheme();
  const { label, symbol } = getToolCopy(name, state);
  const running = state === 'running';
  const error = state === 'error';

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: theme.secondary }]}>
        <SymbolView
          name={symbol as SymbolViewProps['name']}
          size={11}
          tintColor={error ? theme.destructive : theme.secondaryForeground}
          fallback={
            <ThemedText type="small" themeColor="secondaryForeground">
              •
            </ThemedText>
          }
        />
      </View>
      {running ? (
        <Shimmer type="small" themeColor="textSecondary">
          {label}
        </Shimmer>
      ) : (
        <ThemedText type="small" themeColor={error ? 'destructive' : 'textSecondary'}>
          {label}
        </ThemedText>
      )}
    </Animated.View>
  );
}

/**
 * Same quiet activity row, shown while the model is reasoning or composing
 * a reply before any visible output arrives.
 */
export function ThinkingActivity() {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.row}>
      <View style={[styles.iconBadge, { backgroundColor: theme.secondary }]}>
        <SymbolView
          name="brain"
          size={11}
          tintColor={theme.secondaryForeground}
          fallback={
            <ThemedText type="small" themeColor="secondaryForeground">
              •
            </ThemedText>
          }
        />
      </View>
      <Shimmer type="small" themeColor="textSecondary">
        Thinking…
      </Shimmer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
