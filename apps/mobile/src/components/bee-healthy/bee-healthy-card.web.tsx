import { api } from '@beegreat/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { MOOD_BEE_SOURCES } from '@/components/bee-healthy/mood-bee-assets';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import { HYDRATION_GOAL_ML, MOODS } from '@/lib/bee-healthy';
import type { Mood } from '@/lib/bee-healthy';

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
      onPress={() => router.push('/goals/bee-healthy')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <WellnessGlyph
        hydrationProgress={hydrationMl / HYDRATION_GOAL_ML}
        mood={mood?.value ?? null}
      />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.title}>Bee Healthy</ThemedText>
          <View style={styles.todayBadge}>
            <ThemedText style={styles.todayLabel}>Today</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {summary}
        </ThemedText>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

function WellnessGlyph({
  hydrationProgress,
  mood,
}: {
  hydrationProgress: number;
  mood: Mood | null;
}) {
  const fill = Math.min(1, Math.max(0, hydrationProgress));
  const waterHeight = `${Math.round(fill * 76)}%` as `${number}%`;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.glyph}
    >
      <View style={[styles.glyphWater, { height: waterHeight }]}>
        <View style={styles.glyphWave} />
      </View>
      <ExpoImage
        contentFit="contain"
        source={MOOD_BEE_SOURCES[mood ?? 'okay']}
        style={[styles.glyphBee, mood === null && styles.glyphBeeEmpty]}
      />
    </View>
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
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#EFF6E8',
  },
  glyphWater: {
    position: 'absolute',
    right: 7,
    bottom: 6,
    left: 7,
    overflow: 'visible',
    backgroundColor: '#65C8E8',
  },
  glyphWave: {
    position: 'absolute',
    top: -4,
    left: -5,
    width: 51,
    height: 9,
    borderRadius: 999,
    backgroundColor: '#65C8E8',
    transform: [{ rotate: '-4deg' }],
  },
  glyphBee: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 46,
    height: 46,
  },
  glyphBeeEmpty: {
    opacity: 0.72,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  todayBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#E8F2DF',
  },
  todayLabel: {
    color: '#47613F',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
});
