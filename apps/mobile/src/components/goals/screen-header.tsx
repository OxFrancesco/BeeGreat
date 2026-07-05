import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Screen title. Root screens get a large standalone title; screens with
 * `showBack` get a compact navbar row: back arrow, title, optional action.
 */
export function ScreenHeader({
  title,
  showBack,
  right,
}: {
  title: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  const theme = useTheme();

  if (!showBack) {
    return (
      <View style={styles.large}>
        <ThemedText type="subtitle" numberOfLines={2}>
          {title}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={Spacing.two}
        onPress={() => router.back()}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <SymbolView
          name="chevron.left"
          size={20}
          tintColor={theme.text}
          fallback={<ThemedText type="smallBold">Back</ThemedText>}
        />
      </Pressable>
      <ThemedText style={styles.barTitle} numberOfLines={1}>
        {title}
      </ThemedText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  large: {
    paddingVertical: Spacing.two,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  barTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
});
