import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { setMindView, type MindView } from '@/lib/preferences';

const OPTIONS: { value: MindView; label: string }[] = [
  { value: 'hex', label: 'Honeycomb' },
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' },
];

export function ViewSwitcher({ value }: { value: MindView }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  // theme.card is darker than the track in dark mode, so the selected segment
  // uses a lighter fill there, matching the iOS segmented control.
  const selectedFill = dark ? '#3a3a3c' : theme.card;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.container, { backgroundColor: theme.backgroundElement }]}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => setMindView(option.value)}
            style={[
              styles.option,
              selected && {
                backgroundColor: selectedFill,
                boxShadow: '0 1px 5px rgba(0,0,0,0.12)',
              },
            ]}
          >
            <ThemedText type="smallBold" numberOfLines={1}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 3,
  },
  option: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderCurve: 'continuous',
    paddingHorizontal: 6,
  },
});
