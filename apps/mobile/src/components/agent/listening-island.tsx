import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { OrbState } from '@/components/agent/voice-orb';
import { ThemedText } from '@/components/themed-text';
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
export function ListeningIsland({ state }: { state: OrbState }) {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(1);
  const active = state !== 'idle';

  useEffect(() => {
    if (!active) return;
    pulse.value = 1;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [active, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (!active) return null;

  // Dynamic Island devices report a top inset of 59pt; the island itself sits
  // at 11pt and is ~37pt tall, so the pill visually extends it. Everything
  // else (notch or classic status bar) gets the pill just below the inset.
  const hasIsland = Platform.OS === 'ios' && insets.top >= 59;
  const top = hasIsland ? 11 : Math.max(insets.top, Spacing.two) + Spacing.one;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.wrap, { top }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bee is ${LABELS[state].toLowerCase()}. Go to chat.`}
        onPress={() => router.navigate('/')}
        style={({ pressed }) => [
          styles.pill,
          hasIsland && styles.pillIsland,
          pressed && styles.pillPressed,
        ]}
      >
        <Animated.View style={[styles.dot, dotStyle]} />
        <ThemedText type="smallBold" style={styles.label}>
          {LABELS[state]}
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
