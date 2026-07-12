import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MotionDuration, MotionEasing, MotionScale } from '@/constants/motion';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

const SIZE = 208;
const CENTER = SIZE / 2;
const CORE_RADIUS = 64;

const HONEY = {
  light: {
    glow: 'rgba(242, 169, 59, 0.5)',
    core: ['#FFF4DE', '#FFDFB5', '#EFA94F'],
    rim: 'rgba(100, 74, 64, 0.35)',
    ripple: '#EFA94F',
  },
  dark: {
    glow: 'rgba(232, 167, 101, 0.35)',
    core: ['#FFE9CB', '#E8A765', '#7A4E22'],
    rim: 'rgba(255, 224, 194, 0.4)',
    ripple: '#FFE0C2',
  },
} as const;

/**
 * The Bee orb — a Skia-drawn drop of honey that is the agent itself.
 * Breathes while idle, ripples while listening, glows while speaking.
 */
export function VoiceOrb({
  state,
  onPress,
  disabled,
}: {
  state: OrbState;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const reducedMotion = useReducedMotion();
  const honey = HONEY[scheme === 'dark' ? 'dark' : 'light'];

  const breathe = useSharedValue(1);
  const glow = useSharedValue(1);
  const ripple = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(glow);
    cancelAnimation(ripple);
    if (reducedMotion) {
      breathe.value = 1;
      glow.value =
        state === 'listening'
          ? 1.12
          : state === 'thinking'
            ? 1.15
            : state === 'speaking'
              ? 1.25
              : 1;
      ripple.value = 0;
      return () => {
        cancelAnimation(breathe);
        cancelAnimation(glow);
        cancelAnimation(ripple);
      };
    }
    if (state === 'listening') {
      breathe.value = withRepeat(
        withTiming(1.08, { duration: 420, easing: MotionEasing.inOut }),
        -1,
        true,
        undefined,
        ReduceMotion.System,
      );
      glow.value = withTiming(1.12, {
        duration: MotionDuration.progress,
        easing: MotionEasing.out,
      });
      ripple.value = 0;
      ripple.value = withRepeat(
        withTiming(1, { duration: 1100, easing: MotionEasing.out }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
    } else if (state === 'thinking') {
      breathe.value = withRepeat(
        withSequence(withTiming(1.03, { duration: 260 }), withTiming(0.99, { duration: 260 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      glow.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 520 }), withTiming(0.95, { duration: 520 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      ripple.value = withTiming(0, { duration: MotionDuration.enter });
    } else if (state === 'speaking') {
      breathe.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      glow.value = withRepeat(
        withSequence(withTiming(1.25, { duration: 300 }), withTiming(1.05, { duration: 300 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      ripple.value = withTiming(0, { duration: MotionDuration.enter });
    } else {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      );
      glow.value = withTiming(1, {
        duration: MotionDuration.progress,
        easing: MotionEasing.out,
      });
      ripple.value = withTiming(0, { duration: MotionDuration.enter });
    }
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(glow);
      cancelAnimation(ripple);
    };
  }, [state, breathe, glow, reducedMotion, ripple]);

  useEffect(
    () => () => {
      cancelAnimation(pressScale);
    },
    [pressScale],
  );

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    if (reducedMotion) {
      pressScale.set(1);
      return;
    }
    pressScale.set(
      withTiming(MotionScale.pressed, {
        duration: MotionDuration.pressIn,
        easing: MotionEasing.out,
      }),
    );
  };

  const handlePressOut = () => {
    if (reducedMotion) {
      pressScale.set(1);
      return;
    }
    pressScale.set(
      withTiming(1, {
        duration: MotionDuration.pressOut,
        easing: MotionEasing.out,
      }),
    );
  };

  const coreTransform = useDerivedValue(() => [{ scale: breathe.value }]);
  const glowTransform = useDerivedValue(() => [{ scale: glow.value }]);
  const rippleTransform = useDerivedValue(() => [
    { scale: 1 + ripple.value * (34 / (CORE_RADIUS + 6)) },
  ]);
  const rippleOpacity = useDerivedValue(() => (ripple.value === 0 ? 0 : 0.6 * (1 - ripple.value)));

  const listening = state === 'listening';

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop and send' : 'Talk to Bee'}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      >
        <Canvas style={styles.canvas}>
          <Group origin={vec(CENTER, CENTER)} transform={glowTransform}>
            <Circle cx={CENTER} cy={CENTER} r={CORE_RADIUS + 26}>
              <RadialGradient
                c={vec(CENTER, CENTER)}
                r={CORE_RADIUS + 26}
                colors={[honey.glow, 'transparent']}
              />
              <BlurMask blur={18} style="normal" />
            </Circle>
          </Group>

          <Group origin={vec(CENTER, CENTER)} transform={rippleTransform}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={CORE_RADIUS + 6}
              style="stroke"
              strokeWidth={2}
              color={honey.ripple}
              opacity={rippleOpacity}
            />
          </Group>

          <Group origin={vec(CENTER, CENTER)} transform={coreTransform}>
            <Circle cx={CENTER} cy={CENTER} r={CORE_RADIUS}>
              <RadialGradient
                c={vec(CENTER - 18, CENTER - 24)}
                r={CORE_RADIUS * 1.9}
                colors={[...honey.core]}
              />
            </Circle>

            <Circle
              cx={CENTER}
              cy={CENTER}
              r={CORE_RADIUS + 1}
              style="stroke"
              strokeWidth={1.5}
              color={honey.rim}
            />
          </Group>
        </Canvas>

        <SymbolView
          name={listening ? 'waveform' : 'mic.fill'}
          size={40}
          tintColor={scheme === 'dark' ? '#2A1C0E' : theme.secondaryForeground}
          style={styles.icon}
          fallback={
            <ThemedText type="subtitle" themeColor="secondaryForeground" style={styles.icon}>
              {listening ? '||' : 'rec'}
            </ThemedText>
          }
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  canvas: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  icon: {
    position: 'absolute',
  },
});
