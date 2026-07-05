import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type BeeActivityProps = {
  status: string;
  detail: string;
};

/**
 * Native ActivityKit Live Activity: Bee's live status in the real Dynamic
 * Island (compact/minimal/expanded) and on the Lock Screen banner.
 *
 * IMPORTANT: the `'widget'` directive serializes only this function; it is
 * evaluated in the widget extension's runtime where outer-scope variables do
 * not exist. Every value here must be a literal or come from props — a
 * closure reference (e.g. a shared color constant) throws at render time and
 * the activity draws blank. Honey is #FFDFB5, amber is #EFA94F.
 */
const BeeActivity = (props: BeeActivityProps, _environment: LiveActivityEnvironment) => {
  'widget';
  return {
    banner: (
      <HStack modifiers={[padding({ all: 14 })]}>
        <Image systemName="hexagon.fill" color="#EFA94F" />
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
    compactLeading: <Image systemName="hexagon.fill" color="#EFA94F" />,
    compactTrailing: (
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#FFDFB5')]}>{props.status}</Text>
    ),
    minimal: <Image systemName="hexagon.fill" color="#EFA94F" />,
    expandedLeading: <Image systemName="hexagon.fill" color="#EFA94F" />,
    expandedTrailing: (
      <Text modifiers={[font({ weight: 'semibold', size: 15 }), foregroundStyle('#FFDFB5')]}>
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
