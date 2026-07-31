import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Shimmer } from '@/components/agent/shimmer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getToolCopy, type ToolActivityState } from '@/lib/tool-labels';

const POWERUP_PALETTES: Record<
  string,
  { accent: string; solid: string; surface: string; border: string }
> = {
  Devin: {
    accent: '#F2765A',
    solid: '#D85238',
    surface: '#F2765A1A',
    border: '#F2765A66',
  },
  'Google Health': {
    accent: '#39C9AA',
    solid: '#08745F',
    surface: '#16A88A1A',
    border: '#16A88A66',
  },
  Web3: {
    accent: '#A991FF',
    solid: '#6248C6',
    surface: '#8066E81A',
    border: '#8066E866',
  },
};

const DEFAULT_POWERUP_PALETTE = {
  accent: '#FAB52A',
  solid: '#845800',
  surface: '#D991001A',
  border: '#D9910066',
};

/**
 * A human-readable, expandable trace of what the agent is doing. The summary
 * stays quiet, while the disclosure exposes the complete input and result for
 * users who want to inspect the call. Power-up activity becomes a compact
 * specialist cell with its own accent color.
 */
export function ToolActivity({
  name,
  state,
  input,
  output,
  errorText,
}: {
  name: string;
  state: ToolActivityState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();
  const { label, symbol, powerup } = getToolCopy(name, state, input);
  const running = state === 'running';
  const error = state === 'error';
  const powerupPalette = powerup
    ? (POWERUP_PALETTES[powerup] ?? DEFAULT_POWERUP_PALETTE)
    : null;

  const copyDetails = async () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    const result = error
      ? `Error:\n${errorText ?? 'The tool call failed.'}`
      : `Result:\n${running ? 'Waiting for the result…' : formatToolValue(output)}`;
    await Clipboard.setStringAsync(
      [`Tool: ${name}`, `Input:\n${formatToolValue(input)}`, result].join('\n\n'),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activity = running ? (
    <Shimmer
      type="small"
      themeColor="textSecondary"
      style={powerupPalette ? styles.powerupActivity : undefined}
    >
      {label}
    </Shimmer>
  ) : (
    <ThemedText
      type="small"
      themeColor={error ? 'destructive' : 'textSecondary'}
      style={powerupPalette ? styles.powerupActivity : undefined}
    >
      {label}
    </ThemedText>
  );

  const borderColor = error
    ? theme.destructive
    : powerupPalette?.border ?? theme.border;

  return (
    <View
      style={[
        styles.tool,
        {
          backgroundColor: powerupPalette?.surface ?? theme.card,
          borderColor,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${powerup ?? label} tool call details`}
        accessibilityHint={expanded ? 'Collapses the tool call' : 'Expands the complete tool call'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: powerupPalette?.solid ?? theme.secondary,
            },
          ]}
        >
          <SymbolView
            name={symbol as SymbolViewProps['name']}
            size={11}
            tintColor={
              error
                ? theme.destructive
                : powerupPalette
                  ? '#FFFFFF'
                  : theme.secondaryForeground
            }
            fallback={
              <ThemedText type="small" themeColor="secondaryForeground">
                •
              </ThemedText>
            }
          />
        </View>
        {powerup && powerupPalette ? (
          <>
            <View style={styles.label}>
              <ThemedText
                type="smallBold"
                style={[styles.powerupName, { color: powerupPalette.accent }]}
              >
                {powerup}
              </ThemedText>
              {activity}
            </View>
            <View style={[styles.powerupTag, { backgroundColor: powerupPalette.solid }]}>
              <ThemedText type="small" style={styles.powerupTagText}>
                Power-up
              </ThemedText>
            </View>
          </>
        ) : (
          <View style={styles.label}>
            {activity}
          </View>
        )}
        <SymbolView
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={12}
          tintColor={theme.textSecondary}
        />
      </Pressable>
      {expanded ? (
        <View style={[styles.details, { borderTopColor: borderColor }]}>
          <ToolDetail label="Tool" value={name} />
          <ToolDetail label="Input" value={input} />
          {error ? (
            <ToolDetail label="Error" value={errorText ?? 'The tool call failed.'} />
          ) : (
            <ToolDetail
              label="Result"
              value={running ? 'Waiting for the result…' : output}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy tool call details"
            hitSlop={8}
            onPress={copyDetails}
            style={({ pressed }) => [
              styles.copyButton,
              { backgroundColor: theme.card, borderColor: theme.border },
              pressed && styles.headerPressed,
            ]}
          >
            <SymbolView
              name={copied ? 'checkmark' : 'doc.on.doc'}
              size={11}
              tintColor={theme.textSecondary}
              fallback={
                <ThemedText type="small" themeColor="textSecondary">
                  ⧉
                </ThemedText>
              }
            />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {copied ? 'Copied ✓' : 'Copy'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ToolDetail({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.detailSection}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.detailLabel}>
        {label}
      </ThemedText>
      <ThemedText selectable style={styles.detailValue}>
        {formatToolValue(value)}
      </ThemedText>
    </View>
  );
}

function formatToolValue(value: unknown) {
  if (value === undefined) return 'Not available';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
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
    minWidth: 0,
  },
  tool: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    minWidth: 0,
  },
  headerPressed: {
    opacity: 0.7,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerupTag: {
    flexShrink: 1,
    borderRadius: 999,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  powerupTagText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  powerupName: {
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  powerupActivity: {
    fontSize: 13,
    lineHeight: 17,
  },
  details: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  detailSection: {
    gap: Spacing.one,
  },
  copyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
  },
  detailLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
