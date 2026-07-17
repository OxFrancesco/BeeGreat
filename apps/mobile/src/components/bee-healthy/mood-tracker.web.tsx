import { Image as ExpoImage } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { MOOD_BEE_SOURCES } from '@/components/bee-healthy/mood-bee-assets';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MOODS, type Mood } from '@/lib/bee-healthy';

export type MoodTrackerProps = {
  value: Mood | null;
  onChange: (mood: Mood) => void;
  disabled?: boolean;
};

const ORB_SIZE = 178;

export function MoodTracker({ value, onChange, disabled = false }: MoodTrackerProps) {
  const theme = useTheme();
  const selectedLabel = MOODS.find((option) => option.value === value)?.label;

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.orb}
      >
        <ExpoImage
          contentFit="contain"
          source={MOOD_BEE_SOURCES[value ?? 'okay']}
          style={[styles.heroBee, value === null && styles.heroBeeEmpty]}
        />
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
              onPress={() => onChange(option.value)}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBee: {
    width: 174,
    height: 174,
  },
  heroBeeEmpty: {
    opacity: 0.68,
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
