import {
  BlurMask,
  Canvas,
  Circle,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
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
  const honey = HONEY[scheme === 'dark' ? 'dark' : 'light'];

  const breathe = useSharedValue(1);
  const glow = useSharedValue(1);
  const ripple = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(breathe);
    cancelAnimation(glow);
    cancelAnimation(ripple);
    if (state === 'listening') {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 420, easing: Easing.in(Easing.quad) }),
        ),
        -1,
      );
      glow.value = withTiming(1.12, { duration: 300 });
      ripple.value = 0;
      ripple.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1);
    } else if (state === 'thinking') {
      breathe.value = withRepeat(
        withSequence(withTiming(1.03, { duration: 260 }), withTiming(0.99, { duration: 260 })),
        -1,
      );
      glow.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 520 }), withTiming(0.95, { duration: 520 })),
        -1,
      );
      ripple.value = withTiming(0, { duration: 200 });
    } else if (state === 'speaking') {
      breathe.value = withRepeat(
        withSequence(withTiming(1.06, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1,
      );
      glow.value = withRepeat(
        withSequence(withTiming(1.25, { duration: 300 }), withTiming(1.05, { duration: 300 })),
        -1,
      );
      ripple.value = withTiming(0, { duration: 200 });
    } else {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
      glow.value = withTiming(1, { duration: 400 });
      ripple.value = withTiming(0, { duration: 200 });
    }
  }, [state, breathe, glow, ripple]);

  const coreRadius = useDerivedValue(() => CORE_RADIUS * breathe.value);
  const glowRadius = useDerivedValue(() => (CORE_RADIUS + 26) * glow.value);
  const rippleRadius = useDerivedValue(() => CORE_RADIUS + 6 + ripple.value * 34);
  const rippleOpacity = useDerivedValue(() => (ripple.value === 0 ? 0 : 0.6 * (1 - ripple.value)));
  const rimRadius = useDerivedValue(() => coreRadius.value + 1);

  const listening = state === 'listening';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop and send' : 'Talk to Bee'}
      onPress={onPress}
      disabled={disabled}
      style={styles.container}
    >
      <Canvas style={styles.canvas}>
        <Circle cx={CENTER} cy={CENTER} r={glowRadius}>
          <RadialGradient
            c={vec(CENTER, CENTER)}
            r={CORE_RADIUS + 26}
            colors={[honey.glow, 'transparent']}
          />
          <BlurMask blur={18} style="normal" />
        </Circle>

        <Circle
          cx={CENTER}
          cy={CENTER}
          r={rippleRadius}
          style="stroke"
          strokeWidth={2}
          color={honey.ripple}
          opacity={rippleOpacity}
        />

        <Circle cx={CENTER} cy={CENTER} r={coreRadius}>
          <RadialGradient
            c={vec(CENTER - 18, CENTER - 24)}
            r={CORE_RADIUS * 1.9}
            colors={[...honey.core]}
          />
        </Circle>

        <Circle
          cx={CENTER}
          cy={CENTER}
          r={rimRadius}
          style="stroke"
          strokeWidth={1.5}
          color={honey.rim}
        />
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
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
