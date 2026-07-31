import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OrbState } from '@/components/agent/voice-orb';
import { ThemedText } from '@/components/themed-text';
import { MotionDuration, MotionEasing } from '@/constants/motion';
import { Spacing } from '@/constants/theme';

const AMBER = '#FAB52A';

const LABELS: Record<Exclude<OrbState, 'idle'>, string> = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

/**
 * In-app Dynamic Island companion: while the app is foregrounded iOS hides its
 * own ActivityKit Live Activity, so this pill hugs the island (or the status
 * bar on notch-less devices) to surface the mic state on every screen. The
 * real Live Activity (see `bee-activity.tsx`) takes over once the app leaves
 * the foreground. Tapping the pill jumps back to the chat.
 */
export function ListeningIsland({
  state,
  onPress,
}: {
  state: OrbState;
  onPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(1);
  const active = state !== 'idle';
  const reducedMotion = useReducedMotion();
  const visibility = useSharedValue(active ? 1 : 0);
  const [lastActiveState, setLastActiveState] = useState<Exclude<OrbState, 'idle'>>(
    state === 'idle' ? 'listening' : state,
  );
  const [previousState, setPreviousState] = useState(state);
  if (state !== previousState) {
    setPreviousState(state);
    if (state !== 'idle') setLastActiveState(state);
  }

  useEffect(() => {
    cancelAnimation(visibility);
    visibility.value = withTiming(active ? 1 : 0, {
      duration: active ? MotionDuration.enter : MotionDuration.exit,
      easing: MotionEasing.out,
    });
    return () => cancelAnimation(visibility);
  }, [active, visibility]);

  useEffect(() => {
    cancelAnimation(pulse);
    if (!active || reducedMotion) {
      pulse.value = 1;
      return () => cancelAnimation(pulse);
    }
    pulse.value = 1;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 700, easing: MotionEasing.inOut }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [active, pulse, reducedMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const visibilityStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - visibility.value) * -8 }],
  }));

  // Dynamic Island devices report a top inset of 59pt; the island itself sits
  // at 11pt and is ~37pt tall, so the pill visually extends it. Everything
  // else (notch or classic status bar) gets the pill just below the inset.
  const hasIsland = Platform.OS === 'ios' && insets.top >= 59;
  const top = hasIsland ? 11 : Math.max(insets.top, Spacing.two) + Spacing.one;
  const label = LABELS[lastActiveState];

  return (
    <Animated.View
      style={[styles.wrap, { top }, visibilityStyle]}
      pointerEvents={active ? 'box-none' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bee is ${label.toLowerCase()}. Go to chat.`}
        onPress={onPress ?? (() => router.navigate('/'))}
        style={({ pressed }) => [
          styles.pill,
          hasIsland && styles.pillIsland,
          pressed && styles.pillPressed,
        ]}
      >
        <Animated.View style={[styles.dot, dotStyle]} />
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 37,
    minWidth: 126,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: '#000000',
  },
  pillIsland: {
    // Match the island's own corner radius so the pill reads as an extension.
    borderCurve: 'continuous',
  },
  pillPressed: {
    opacity: 0.85,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AMBER,
  },
  label: {
    color: '#FFDFB5',
  },
});
