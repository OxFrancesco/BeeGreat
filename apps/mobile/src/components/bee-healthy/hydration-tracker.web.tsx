import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { HYDRATION_GOAL_ML, MAX_HYDRATION_ML } from '@/lib/bee-healthy';

export type HydrationTrackerProps = {
  valueMl: number;
  goalMl: number;
  onAdd: (amountMl: number) => void;
  onRemove: (amountMl: number) => void;
  disabled?: boolean;
};

const WATER = {
  light: {
    reservoir: '#EAF2F1',
    cap: '#F3D29C',
    outline: '#705044',
    back: '#8FD3DA',
    front: '#2F8795',
    shine: 'rgba(255, 255, 255, 0.46)',
  },
  dark: {
    reservoir: '#253130',
    cap: '#765B3D',
    outline: '#F1D0B0',
    back: '#58A9B4',
    front: '#205D69',
    shine: 'rgba(255, 255, 255, 0.34)',
  },
} as const;

function formatMl(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function HydrationTracker({
  valueMl,
  goalMl,
  onAdd,
  onRemove,
  disabled = false,
}: HydrationTrackerProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const water = WATER[scheme === 'dark' ? 'dark' : 'light'];
  const currentMl = Number.isFinite(valueMl) ? Math.max(0, Math.round(valueMl)) : 0;
  const normalizedGoalMl =
    Number.isFinite(goalMl) && goalMl > 0 ? Math.round(goalMl) : HYDRATION_GOAL_ML;
  const fillRatio = Math.min(1, currentMl / normalizedGoalMl);
  const percentage = Math.round(fillRatio * 100);
  const overflowMl = Math.max(0, currentMl - normalizedGoalMl);
  const remainingMl = Math.max(0, normalizedGoalMl - currentMl);
  const waterHeight = `${Math.round(fillRatio * 100)}%` as `${number}%`;

  const progressText =
    overflowMl > 0
      ? `${formatMl(currentMl)} of ${formatMl(normalizedGoalMl)} milliliters, goal reached with ${formatMl(overflowMl)} extra`
      : `${formatMl(currentMl)} of ${formatMl(normalizedGoalMl)} milliliters, ${percentage}%`;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Daily hydration"
        accessibilityValue={{
          min: 0,
          max: normalizedGoalMl,
          now: Math.min(currentMl, normalizedGoalMl),
          text: progressText,
        }}
        style={styles.progress}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.bottleStage}
        >
          <View
            style={[
              styles.bottle,
              { backgroundColor: water.reservoir, borderColor: water.outline },
            ]}
          >
            <View style={[styles.water, { height: waterHeight, backgroundColor: water.front }]}>
              <View style={[styles.backWave, { backgroundColor: water.back }]} />
              <View style={[styles.frontWave, { backgroundColor: water.front }]} />
              <View style={[styles.bubbleLarge, { backgroundColor: water.shine }]} />
              <View style={[styles.bubbleSmall, { backgroundColor: water.shine }]} />
            </View>
            <View style={[styles.shine, { backgroundColor: water.shine }]} />
          </View>
          <View style={[styles.neck, { backgroundColor: water.reservoir, borderColor: water.outline }]} />
          <View style={[styles.cap, { backgroundColor: water.cap, borderColor: water.outline }]} />
          <View style={styles.measurements}>
            {[0, 1, 2, 3].map((tick) => (
              <View key={tick} style={[styles.tick, { backgroundColor: water.outline }]} />
            ))}
          </View>
        </View>

        <View style={styles.readout}>
          <ThemedText selectable style={styles.amount}>
            {formatMl(currentMl)} / {formatMl(normalizedGoalMl)} ml
          </ThemedText>
          <ThemedText selectable type="small" themeColor="textSecondary" style={styles.detail}>
            {overflowMl > 0
              ? `Daily goal reached · ${formatMl(overflowMl)} ml extra`
              : remainingMl === 0
                ? 'Daily goal reached'
                : `${formatMl(remainingMl)} ml to go`}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <HydrationButton
          label="−250"
          accessibilityLabel="Remove 250 milliliters"
          disabled={disabled || currentMl === 0}
          onPress={() => onRemove(250)}
          backgroundColor={theme.card}
          borderColor={theme.border}
          textColor={theme.textSecondary}
        />
        <HydrationButton
          label="+250"
          accessibilityLabel="Add 250 milliliters"
          disabled={disabled || currentMl >= MAX_HYDRATION_ML}
          onPress={() => onAdd(250)}
          backgroundColor={theme.primary}
          borderColor={theme.primary}
          textColor={theme.primaryForeground}
        />
        <HydrationButton
          label="+500"
          accessibilityLabel="Add up to 500 milliliters"
          disabled={disabled || currentMl >= MAX_HYDRATION_ML}
          onPress={() => onAdd(500)}
          backgroundColor={theme.card}
          borderColor={theme.border}
          textColor={theme.text}
        />
      </View>
    </View>
  );
}

function HydrationButton({
  label,
  accessibilityLabel,
  disabled,
  onPress,
  backgroundColor,
  borderColor,
  textColor,
}: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor, borderColor },
        disabled && styles.actionDisabled,
        pressed && styles.pressed,
      ]}
    >
      <ThemedText style={[styles.actionLabel, { color: textColor }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  disabled: {
    opacity: 0.55,
  },
  progress: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  bottleStage: {
    width: 200,
    height: 240,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bottle: {
    width: 108,
    height: 190,
    overflow: 'hidden',
    borderWidth: 3,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderBottomLeftRadius: 31,
    borderBottomRightRadius: 31,
  },
  neck: {
    position: 'absolute',
    top: 23,
    width: 42,
    height: 34,
    borderRightWidth: 3,
    borderLeftWidth: 3,
  },
  cap: {
    position: 'absolute',
    top: 7,
    width: 50,
    height: 19,
    borderWidth: 3,
    borderRadius: 9,
  },
  water: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
  },
  backWave: {
    position: 'absolute',
    top: -7,
    left: -10,
    width: 75,
    height: 17,
    borderRadius: 999,
    transform: [{ rotate: '-7deg' }],
  },
  frontWave: {
    position: 'absolute',
    top: -5,
    right: -11,
    width: 76,
    height: 15,
    borderRadius: 999,
    transform: [{ rotate: '6deg' }],
  },
  bubbleLarge: {
    position: 'absolute',
    top: 28,
    left: 26,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  bubbleSmall: {
    position: 'absolute',
    top: 66,
    right: 27,
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  shine: {
    position: 'absolute',
    top: 32,
    left: 13,
    width: 6,
    height: 72,
    borderRadius: 999,
  },
  measurements: {
    position: 'absolute',
    top: 76,
    right: 27,
    gap: 24,
  },
  tick: {
    width: 9,
    height: 2,
    borderRadius: 999,
    opacity: 0.34,
  },
  readout: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  amount: {
    fontFamily: Fonts.rounded,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  detail: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
  },
  actionDisabled: {
    opacity: 0.38,
  },
  actionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
