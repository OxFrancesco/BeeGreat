import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Compact navbar for Bee Healthy section screens: back-to-app, title, date. */
export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const theme = useTheme();

  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave Bee Healthy"
        hitSlop={Spacing.two}
        onPress={() => {
          if (router.canDismiss()) {
            router.dismiss();
          } else {
            router.back();
          }
        }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <SymbolView
          name="chevron.left"
          size={20}
          tintColor={theme.text}
          fallback={<ThemedText type="smallBold">Back</ThemedText>}
        />
      </Pressable>
      <View style={styles.copy}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.7,
  },
});
