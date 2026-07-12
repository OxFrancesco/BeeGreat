import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FloatingBee } from '@/components/floating-bee';
import { ThemedText } from '@/components/themed-text';
import { MotionDuration, MotionEasing, MotionScale } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { getGolieBeeName } from '@/lib/first-focus';

export function GolieBee({
  seed,
  compact = false,
  celebrating = false,
}: {
  seed: string;
  compact?: boolean;
  celebrating?: boolean;
}) {
  const name = getGolieBeeName(seed);
  const reducedMotion = useReducedMotion();
  const previousCelebrating = useRef(celebrating);
  const celebrationScale = useSharedValue(celebrating ? 1.06 : 1);

  useEffect(() => {
    const wasCelebrating = previousCelebrating.current;
    previousCelebrating.current = celebrating;
    cancelAnimation(celebrationScale);

    if (celebrating) {
      if (!wasCelebrating && !reducedMotion) {
        celebrationScale.value = MotionScale.enter;
        celebrationScale.value = withSpring(1.06, {
          mass: 1,
          stiffness: 100,
          damping: 10,
        });
      } else {
        celebrationScale.value = 1.06;
      }
    } else if (wasCelebrating && !reducedMotion) {
      celebrationScale.value = withTiming(1, {
        duration: MotionDuration.pressOut,
        easing: MotionEasing.out,
      });
    } else {
      celebrationScale.value = 1;
    }

    return () => cancelAnimation(celebrationScale);
  }, [celebrating, celebrationScale, reducedMotion]);

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        celebrating
          ? `${name}, the GolieBee for this goal, is celebrating progress`
          : `${name}, the GolieBee for this goal`
      }
      style={[styles.container, compact && styles.compact]}
    >
      <Animated.View style={[styles.beeFrame, celebrationStyle]}>
        <FloatingBee height={compact ? 70 : 102} />
        {celebrating ? (
          <ThemedText style={styles.sparkles} accessibilityElementsHidden>
            ✦
          </ThemedText>
        ) : null}
      </Animated.View>
      <View style={styles.copy}>
        <ThemedText type="smallBold" selectable>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {celebrating ? 'Buzzing with progress' : 'Your GolieBee'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  compact: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: Spacing.two,
  },
  beeFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkles: {
    position: 'absolute',
    top: 2,
    right: 0,
    color: '#FAB52A',
    fontSize: 24,
    lineHeight: 28,
  },
  copy: {
    alignItems: 'center',
  },
});
