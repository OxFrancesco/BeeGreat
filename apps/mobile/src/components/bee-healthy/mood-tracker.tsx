import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import {
  BEE_DOCTOR_SOURCE,
  MOOD_BEE_SOURCES,
} from '@/components/bee-healthy/mood-bee-assets';
import { MotionDuration, MotionEasing } from '@/constants/motion';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MOODS, type Mood } from '@/lib/bee-healthy';

export type MoodTrackerProps = {
  value: Mood | null;
  onChange: (mood: Mood) => void;
  disabled?: boolean;
};

const ORB_SIZE = 178;
const ORB_CENTER = ORB_SIZE / 2;

function triggerSelectionHaptic() {
  if (process.env.EXPO_OS === 'ios') {
    void Haptics.selectionAsync();
  }
}

export function MoodTracker({ value, onChange, disabled = false }: MoodTrackerProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const selectedBee = useImage(
    value ? MOOD_BEE_SOURCES[value] : BEE_DOCTOR_SOURCE,
  );
  const reveal = useSharedValue(1);
  const selectedLabel = MOODS.find((option) => option.value === value)?.label;

  useEffect(() => {
    cancelAnimation(reveal);
    reveal.value = reducedMotion ? 1 : 0.93;
    if (!reducedMotion) {
      reveal.value = withTiming(1, {
        duration: MotionDuration.progress,
        easing: MotionEasing.out,
      });
    }

    return () => cancelAnimation(reveal);
  }, [reducedMotion, reveal, value]);

  const beeTransform = useDerivedValue(() => [{ scale: reveal.value }]);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.orb}
      >
        <Canvas style={styles.canvas}>
          {selectedBee ? (
            <Group
              opacity={1}
              origin={vec(ORB_CENTER, ORB_CENTER)}
              transform={beeTransform}
            >
              <SkiaImage
                fit="contain"
                height={ORB_SIZE - 4}
                image={selectedBee}
                sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
                width={ORB_SIZE - 4}
                x={2}
                y={2}
              />
            </Group>
          ) : null}
        </Canvas>
      </View>

      <ThemedText
        accessibilityLiveRegion="polite"
        type="smallBold"
        themeColor={value === null ? 'textSecondary' : 'text'}
        style={styles.status}
      >
        {selectedLabel ? `${selectedLabel} feels closest` : 'Choose what feels closest'}
      </ThemedText>

      <View accessibilityRole="radiogroup" accessibilityLabel="Mood" style={styles.options}>
        {MOODS.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={`${option.label} mood`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => {
                triggerSelectionHaptic();
                onChange(option.value);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? theme.backgroundSelected : theme.card,
                  borderColor: selected ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <ExpoImage
                accessibilityElementsHidden
                contentFit="contain"
                importantForAccessibility="no"
                source={MOOD_BEE_SOURCES[option.value]}
                style={styles.optionBee}
              />
              <ThemedText
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                numberOfLines={1}
                style={[styles.optionLabel, selected && styles.selectedLabel]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  disabled: {
    opacity: 0.55,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  canvas: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  status: {
    minHeight: 20,
    textAlign: 'center',
  },
  options: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  option: {
    minWidth: 0,
    minHeight: 64,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.half,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  optionBee: {
    width: 28,
    height: 28,
  },
  optionLabel: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedLabel: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
