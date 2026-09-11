import type { BeeAnimation } from '@beegreat/tool-presentation';
import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const sources = {
  idle: {
    animated: require('../../assets/images/bee/idle.webp'),
    still: require('../../assets/images/bee/idle-still.png'),
  },
  fly: {
    animated: require('../../assets/images/bee/fly.webp'),
    still: require('../../assets/images/bee/fly-still.png'),
  },
  happy: {
    animated: require('../../assets/images/bee/happy.webp'),
    still: require('../../assets/images/bee/happy-still.png'),
  },
  sad: {
    animated: require('../../assets/images/bee/sad.webp'),
    still: require('../../assets/images/bee/sad-still.png'),
  },
  thinking: {
    animated: require('../../assets/images/bee/thinking.webp'),
    still: require('../../assets/images/bee/thinking-still.png'),
  },
  fail: {
    animated: require('../../assets/images/bee/fail.webp'),
    still: require('../../assets/images/bee/fail-still.png'),
  },
  succeed: {
    animated: require('../../assets/images/bee/succeed.webp'),
    still: require('../../assets/images/bee/succeed-still.png'),
  },
} satisfies Record<BeeAnimation, { animated: number; still: number }>;

export function FloatingBee({
  height = 88,
  style,
  animation = 'idle',
  animate = true,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
  animation?: BeeAnimation;
  animate?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const playing = animate && !reducedMotion;
  const source = sources[animation];
  return (
    <View style={style}>
      <Image
        key={`${animation}-${playing}`}
        source={playing ? source.animated : source.still}
        style={{ width: height, height, backgroundColor: 'transparent' }}
        contentFit="contain"
        autoplay={playing}
      />
    </View>
  );
}
