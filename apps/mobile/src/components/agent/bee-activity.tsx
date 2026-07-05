import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type BeeActivityProps = {
  status: string;
  detail: string;
};

const HONEY = '#FFDFB5';
const AMBER = '#EFA94F';

/**
 * Native ActivityKit Live Activity: Bee's live status in the real Dynamic
 * Island (compact/minimal/expanded) and on the Lock Screen banner.
 */
const BeeActivity = (props: BeeActivityProps, _environment: LiveActivityEnvironment) => {
  'widget';
  return {
    banner: (
      <HStack modifiers={[padding({ all: 14 })]}>
        <Image systemName="hexagon.fill" color={AMBER} />
        <VStack modifiers={[padding({ leading: 10 })]}>
          <Text modifiers={[font({ weight: 'semibold', size: 15 })]}>{props.status}</Text>
          {props.detail ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle('#9A9A9A')]}>
              {props.detail}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    ),
    compactLeading: <Image systemName="hexagon.fill" color={AMBER} />,
    compactTrailing: <Text modifiers={[font({ size: 12 }), foregroundStyle(HONEY)]}>{props.status}</Text>,
    minimal: <Image systemName="hexagon.fill" color={AMBER} />,
    expandedLeading: <Image systemName="hexagon.fill" color={AMBER} />,
    expandedTrailing: (
      <Text modifiers={[font({ weight: 'semibold', size: 15 }), foregroundStyle(HONEY)]}>
        {props.status}
      </Text>
    ),
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#9A9A9A'), padding({ all: 8 })]}>
        {props.detail || 'Bee is with you'}
      </Text>
    ),
  };
};

export default createLiveActivity('BeeActivity', BeeActivity);
