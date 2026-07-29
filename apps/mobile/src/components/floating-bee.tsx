import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// Animated bee (transparent animated WebP), rendered from the 3D asset's
// idle clip via tools/bee-3d/render_app_assets.py.
const BEE_SOURCE = require('../../assets/images/bee.webp');
/** Intrinsic size of the animation frames, used to keep the aspect ratio. */
const BEE = { width: 512, height: 512 } as const;

/**
 * The little animated bee, with a transparent background.
 * Pauses on the first frame when reduced motion is enabled.
 */
export function FloatingBee({
  height = 88,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const width = (BEE.width / BEE.height) * height;

  return (
    <View style={style}>
      <Image
        source={BEE_SOURCE}
        style={{ width, height, backgroundColor: 'transparent' }}
        contentFit="contain"
        autoplay={!reducedMotion}
      />
    </View>
  );
}
