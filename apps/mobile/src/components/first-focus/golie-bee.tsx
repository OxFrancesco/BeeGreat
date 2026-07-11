import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { FloatingBee } from '@/components/floating-bee';
import { ThemedText } from '@/components/themed-text';
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
      <Animated.View
        entering={celebrating && !reducedMotion ? ZoomIn.springify().damping(12) : undefined}
        style={[styles.beeFrame, celebrating && styles.celebratingFrame]}
      >
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
  celebratingFrame: {
    transform: [{ scale: 1.06 }],
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
