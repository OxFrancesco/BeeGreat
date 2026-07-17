import {
  Canvas,
  Circle,
  Group,
  Path,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MotionDuration, MotionEasing } from '@/constants/motion';
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

const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 240;
const FRONT_WAVE_PERIOD = 96;
const BACK_WAVE_PERIOD = 128;
const EMPTY_FILL_Y = 200;
const FULL_FILL_Y = -44;

const BOTTLE_PATH_DATA =
  'M 80 12 C 80 7 84 4 89 4 L 111 4 C 116 4 120 7 120 12 L 120 29 C 120 36 123 40 130 44 C 145 53 154 69 154 87 L 154 198 C 154 219 139 232 119 232 L 81 232 C 61 232 46 219 46 198 L 46 87 C 46 69 55 53 70 44 C 77 40 80 36 80 29 L 80 12 Z';

const FRONT_WAVE_PATH_DATA =
  'M -96 40 C -80 28 -64 28 -48 40 C -32 52 -16 52 0 40 C 16 28 32 28 48 40 C 64 52 80 52 96 40 C 112 28 128 28 144 40 C 160 52 176 52 192 40 C 208 28 224 28 240 40 C 256 52 272 52 288 40 C 304 28 320 28 336 40 L 336 300 L -96 300 Z';

const BACK_WAVE_PATH_DATA =
  'M -128 40 C -107 32 -85 32 -64 40 C -43 48 -21 48 0 40 C 21 32 43 32 64 40 C 85 48 107 48 128 40 C 149 32 171 32 192 40 C 213 48 235 48 256 40 C 277 32 299 32 320 40 C 341 48 363 48 384 40 L 384 300 L -128 300 Z';

const BOTTLE_DETAIL_PATH_DATA =
  'M 134 91 L 143 91 M 134 119 L 143 119 M 134 147 L 143 147 M 134 175 L 143 175';

const WATER = {
  light: {
    reservoir: '#EAF2F1',
    cap: '#F3D29C',
    outline: '#705044',
    backTop: '#B7E4E8',
    backBottom: '#72C4CC',
    frontTop: '#75CBD4',
    frontBottom: '#2F8795',
    detail: 'rgba(88, 103, 100, 0.34)',
  },
  dark: {
    reservoir: '#253130',
    cap: '#765B3D',
    outline: '#F1D0B0',
    backTop: '#69BBC3',
    backBottom: '#397F8A',
    frontTop: '#4BA5B2',
    frontBottom: '#205D69',
    detail: 'rgba(224, 235, 232, 0.38)',
  },
} as const;

function parsePath(pathData: string) {
  const path = Skia.Path.MakeFromSVGString(pathData);
  if (!path) throw new Error(`Invalid Bee Healthy hydration path: ${pathData}`);
  return path;
}

function formatMl(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function triggerImpactHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
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
  const reducedMotion = useReducedMotion();
  const water = WATER[scheme === 'dark' ? 'dark' : 'light'];
  const currentMl = Number.isFinite(valueMl) ? Math.max(0, Math.round(valueMl)) : 0;
  const normalizedGoalMl =
    Number.isFinite(goalMl) && goalMl > 0 ? Math.round(goalMl) : HYDRATION_GOAL_ML;
  const fillRatio = Math.min(1, currentMl / normalizedGoalMl);
  const percentage = Math.round(fillRatio * 100);
  const overflowMl = Math.max(0, currentMl - normalizedGoalMl);
  const remainingMl = Math.max(0, normalizedGoalMl - currentMl);
  const targetFillY = EMPTY_FILL_Y + (FULL_FILL_Y - EMPTY_FILL_Y) * fillRatio;

  const { bottlePath, frontWavePath, backWavePath, bottleDetailPath } = useMemo(
    () => ({
      bottlePath: parsePath(BOTTLE_PATH_DATA),
      frontWavePath: parsePath(FRONT_WAVE_PATH_DATA),
      backWavePath: parsePath(BACK_WAVE_PATH_DATA),
      bottleDetailPath: parsePath(BOTTLE_DETAIL_PATH_DATA),
    }),
    [],
  );

  const fillY = useSharedValue(targetFillY);
  const frontWaveX = useSharedValue(0);
  const backWaveX = useSharedValue(-BACK_WAVE_PERIOD);

  useEffect(() => {
    cancelAnimation(fillY);
    fillY.value = reducedMotion
      ? targetFillY
      : withTiming(targetFillY, {
          duration: MotionDuration.progress,
          easing: MotionEasing.out,
        });
    return () => cancelAnimation(fillY);
  }, [fillY, reducedMotion, targetFillY]);

  useEffect(() => {
    cancelAnimation(frontWaveX);
    cancelAnimation(backWaveX);

    if (reducedMotion) {
      frontWaveX.value = 0;
      backWaveX.value = -BACK_WAVE_PERIOD;
    } else {
      frontWaveX.value = 0;
      frontWaveX.value = withRepeat(
        withTiming(-FRONT_WAVE_PERIOD, {
          duration: 3_600,
          easing: Easing.linear,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      backWaveX.value = -BACK_WAVE_PERIOD;
      backWaveX.value = withRepeat(
        withTiming(0, {
          duration: 5_200,
          easing: Easing.linear,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
    }

    return () => {
      cancelAnimation(frontWaveX);
      cancelAnimation(backWaveX);
    };
  }, [backWaveX, frontWaveX, reducedMotion]);

  const frontWaveTransform = useDerivedValue(() => [
    { translateX: frontWaveX.value },
    { translateY: fillY.value },
  ]);
  const backWaveTransform = useDerivedValue(() => [
    { translateX: backWaveX.value },
    { translateY: fillY.value + 5 },
  ]);

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
          style={styles.bottle}
        >
          <Canvas style={styles.canvas}>
            <Path path={bottlePath} color={water.reservoir} />

            <Group clip={bottlePath}>
              <Group transform={backWaveTransform}>
                <Path path={backWavePath} color={water.backTop} />
              </Group>
              <Group transform={frontWaveTransform}>
                <Path path={frontWavePath} color={water.frontBottom} />
                <Circle cx={74} cy={93} r={4} color="rgba(255, 255, 255, 0.34)" />
                <Circle cx={112} cy={132} r={2.5} color="rgba(255, 255, 255, 0.26)" />
                <Circle cx={91} cy={169} r={3} color="rgba(255, 255, 255, 0.22)" />
              </Group>
            </Group>

            <Path
              path={bottlePath}
              color={water.outline}
              style="stroke"
              strokeWidth={3}
              strokeJoin="round"
            />
            <RoundedRect
              x={76}
              y={0}
              width={48}
              height={16}
              r={8}
              color={water.cap}
              style="fill"
            />
            <RoundedRect
              x={76}
              y={0}
              width={48}
              height={16}
              r={8}
              color={water.outline}
              style="stroke"
              strokeWidth={3}
            />
            <Path
              path={bottleDetailPath}
              color={water.detail}
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
            />
            <Path
              path="M 68 78 C 61 91 61 116 61 143"
              color="rgba(255, 255, 255, 0.38)"
              style="stroke"
              strokeWidth={5}
              strokeCap="round"
            />
          </Canvas>
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
          onPress={() => {
            triggerImpactHaptic();
            onRemove(250);
          }}
          backgroundColor={theme.card}
          borderColor={theme.border}
          textColor={theme.textSecondary}
        />
        <HydrationButton
          label="+250"
          accessibilityLabel="Add 250 milliliters"
          disabled={disabled || currentMl >= MAX_HYDRATION_ML}
          onPress={() => {
            triggerImpactHaptic();
            onAdd(250);
          }}
          backgroundColor={theme.primary}
          borderColor={theme.primary}
          textColor={theme.primaryForeground}
        />
        <HydrationButton
          label="+500"
          accessibilityLabel="Add up to 500 milliliters"
          disabled={disabled || currentMl >= MAX_HYDRATION_ML}
          onPress={() => {
            triggerImpactHaptic();
            onAdd(500);
          }}
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
  bottle: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
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
