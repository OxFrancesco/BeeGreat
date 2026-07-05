import { Canvas, Group, ImageSVG, useSVG } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The bee lives in the 607x1080 honeypot scene; we crop her out of the vector
// artwork so she stays crisp at any size.
const SVG_WIDTH = 607;
const SVG_HEIGHT = 1080;
/** Bounding box of the bee (without her ground shadow), in scene units. */
const BEE = { x: 140, y: 570, width: 200, height: 205 } as const;

/**
 * The little bee from the sign-in scene, gently hovering in place.
 * Fully vector, respects reduced motion.
 */
export function FloatingBee({
  height = 88,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const svg = useSVG(require('../../assets/images/honeypot.svg'));
  const reducedMotion = useReducedMotion();
  const float = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    float.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [float, reducedMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (float.value - 0.5) * 14 },
      { rotate: `${(float.value - 0.5) * 6}deg` },
    ],
  }));

  const beeScale = height / BEE.height;
  const beeWidth = BEE.width * beeScale;

  return (
    <Animated.View style={[style, floatStyle]}>
      <Canvas style={{ width: beeWidth, height }}>
        {svg ? (
          <Group transform={[{ scale: beeScale }, { translateX: -BEE.x }, { translateY: -BEE.y }]}>
            <ImageSVG svg={svg} x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} />
          </Group>
        ) : null}
      </Canvas>
    </Animated.View>
  );
}
