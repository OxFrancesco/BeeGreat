import { api } from '@beegreat/backend/convex/_generated/api';
import {
  Canvas,
  FilterMode,
  Group,
  Image as SkiaImage,
  MipmapMode,
  Path,
  RoundedRect,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MOOD_BEE_SOURCES } from '@/components/bee-healthy/mood-bee-assets';
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
  const hydrationPercent = Math.min(100, Math.round((hydrationMl / HYDRATION_GOAL_ML) * 100));

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
  const beeImage = useImage(MOOD_BEE_SOURCES[mood ?? 'okay']);
  const waterPath = useMemo(() => {
    const fill = Math.min(1, Math.max(0, hydrationProgress));
    const y = 52 - fill * 28;
    const builder = Skia.PathBuilder.Make();
    builder.moveTo(8, y);
    builder.cubicTo(20, y - 3, 30, y + 3, 42, y);
    builder.lineTo(42, 52);
    builder.lineTo(8, 52);
    builder.close();
    return builder.build();
  }, [hydrationProgress]);

  return (
    <Canvas
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.glyph}
    >
      <RoundedRect x={1} y={1} width={56} height={56} r={18} color="#EFF6E8" />
      <Group clip={{ x: 8, y: 8, width: 42, height: 44 }}>
        <Path path={waterPath} color="#65C8E8" />
      </Group>
      {beeImage ? (
        <SkiaImage
          fit="contain"
          height={46}
          image={beeImage}
          opacity={mood === null ? 0.72 : 1}
          sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
          width={46}
          x={6}
          y={6}
        />
      ) : null}
    </Canvas>
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
