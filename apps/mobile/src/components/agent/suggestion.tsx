import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** RN port of the ai-elements Suggestion row: tappable prompts that send a message. */

export function Suggestions({ children }: PropsWithChildren) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}

export function Suggestion({
  suggestion,
  onPress,
}: {
  suggestion: string;
  onPress: (suggestion: string) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(suggestion)}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <ThemedText type="small">{suggestion}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    alignSelf: 'stretch',
  },
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.half,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
