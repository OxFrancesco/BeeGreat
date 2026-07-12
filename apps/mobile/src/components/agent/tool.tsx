import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Shimmer } from '@/components/agent/shimmer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getToolCopy, type ToolActivityState } from '@/lib/tool-labels';

/**
 * Quiet, human-readable trace of what the agent is doing. Tool internals
 * (names, inputs, outputs) are deliberately never shown to the user.
 * Power-up activity (delegations to power-up specialists and their tools)
 * carries the primary tint plus a small power-up tag so it reads as special.
 */
export function ToolActivity({
  name,
  state,
  input,
}: {
  name: string;
  state: ToolActivityState;
  input?: unknown;
}) {
  const theme = useTheme();
  const { label, symbol, powerup } = getToolCopy(name, state, input);
  const running = state === 'running';
  const error = state === 'error';

  return (
    <View style={styles.row}>
      <View
        style={[styles.iconBadge, { backgroundColor: powerup ? theme.primary : theme.secondary }]}
      >
        <SymbolView
          name={symbol as SymbolViewProps['name']}
          size={11}
          tintColor={
            error
              ? theme.destructive
              : powerup
                ? theme.primaryForeground
                : theme.secondaryForeground
          }
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
      {powerup ? (
        <View style={[styles.powerupTag, { borderColor: theme.primary }]}>
          <ThemedText type="small" themeColor="primary" style={styles.powerupTagText}>
            {powerup}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Same quiet activity row, shown while the model is reasoning or composing
 * a reply before any visible output arrives.
 */
export function ThinkingActivity() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
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
    </View>
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
  powerupTag: {
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  powerupTagText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
