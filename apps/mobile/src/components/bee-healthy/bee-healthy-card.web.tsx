import { api } from '@beegreat/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { BEE_DOCTOR_SOURCE } from '@/components/bee-healthy/mood-bee-assets';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import { HYDRATION_GOAL_ML, MOODS } from '@/lib/bee-healthy';

const GLYPH_SIZE = 58;

export function BeeHealthyCard() {
  const theme = useTheme();
  const { localDate } = useCurrentLocalDay();
  const entry = useQuery(api.healthJournal.getByDate, { localDate });
  const mood = entry?.mood ? MOODS.find((option) => option.value === entry.mood) : null;
  const hydrationMl = entry?.hydrationMl ?? 0;
  const hydrationPercent = Math.min(
    100,
    Math.round((hydrationMl / HYDRATION_GOAL_ML) * 100),
  );

  const summary =
    entry === undefined
      ? 'Loading today\'s ritual…'
      : mood || hydrationMl > 0
        ? `${mood?.label ?? 'Mood not checked'} · ${hydrationPercent}% hydrated`
        : 'Mood, water, and one honest thought';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Bee Healthy. ${summary}`}
      onPress={() => router.push('/bee-healthy')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <ExpoImage
        accessibilityElementsHidden
        contentFit="contain"
        importantForAccessibility="no-hide-descendants"
        source={BEE_DOCTOR_SOURCE}
        style={styles.glyph}
      />
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Bee Healthy</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {summary}
        </ThemedText>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
