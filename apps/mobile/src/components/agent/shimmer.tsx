import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';

/**
 * RN port of the ai-elements Shimmer: animated emphasis for in-progress
 * labels ("Thinking…"). Web sweeps a gradient across the glyphs; native
 * approximates it with a smooth brightness pulse.
 */
export function Shimmer({
  children,
  duration = 2,
  ...rest
}: ThemedTextProps & { children: string; duration?: number }) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: (duration * 1000) / 2, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [duration, progress]);

  const style = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View style={style}>
      <ThemedText {...rest}>{children}</ThemedText>
    </Animated.View>
  );
}
