import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Screen title with an optional back button and eyebrow line above it. */
export function ScreenHeader({
  title,
  eyebrow,
  showBack,
}: {
  title: string;
  eyebrow?: string;
  showBack?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={Spacing.two}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <SymbolView
            name="chevron.left"
            size={20}
            tintColor={theme.text}
            fallback={<ThemedText type="smallBold">Back</ThemedText>}
          />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        {eyebrow ? (
          <ThemedText type="small" themeColor="textSecondary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="subtitle" numberOfLines={2}>
          {title}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  titles: {
    gap: Spacing.half,
  },
});
