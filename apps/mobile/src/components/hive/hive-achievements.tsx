import { Canvas, Path } from "@shopify/react-native-skia";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { makeRoundedPolygonPath } from "@/components/hex-avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type AchievementSummary = {
  id: string;
  title: string;
  kind: "goliebee" | "hive";
  rank?: number;
};

/**
 * Honey-tier medallions. Placeholder art: hexagonal Skia badges until the
 * real badge set is designed.
 */
const TIERS = {
  comb: { fill: "#FFDFB5", stroke: "#E5A857", icon: "#482401" },
  honey: { fill: "#FAB52A", stroke: "#D88909", icon: "#482401" },
  gold: { fill: "#D88909", stroke: "#A86400", icon: "#FFF3DC" },
} as const;

type BadgeDefinition = {
  id: string;
  title: string;
  caption: string;
  icon: string;
  tier: keyof typeof TIERS;
  /** Secret badges show as "???" until unlocked. */
  secret?: boolean;
  isUnlocked: (unlocks: AchievementSummary[]) => boolean;
};

const taskRank = (rank: number) => (unlocks: AchievementSummary[]) =>
  unlocks.some((unlock) => unlock.id.includes(":tasks:") && unlock.rank === rank);

const BADGES: BadgeDefinition[] = [
  {
    id: "tasks-1",
    title: "Busy Bee",
    caption: "First task done",
    icon: "checkmark",
    tier: "comb",
    isUnlocked: taskRank(1),
  },
  {
    id: "tasks-5",
    title: "Worker Bee",
    caption: "5 tasks on one Goal",
    icon: "bolt.fill",
    tier: "honey",
    isUnlocked: taskRank(5),
  },
  {
    id: "tasks-25",
    title: "Queen's Guard",
    caption: "25 tasks on one Goal",
    icon: "shield.fill",
    tier: "gold",
    isUnlocked: taskRank(25),
  },
  {
    id: "goals-1",
    title: "First Harvest",
    caption: "Complete a Goal",
    icon: "leaf.fill",
    tier: "comb",
    isUnlocked: (unlocks) =>
      unlocks.some((unlock) => unlock.id === "hive:completed-goals:1"),
  },
  {
    id: "goals-2",
    title: "Full Comb",
    caption: "Complete 2 Goals",
    icon: "hexagon.fill",
    tier: "honey",
    isUnlocked: (unlocks) =>
      unlocks.some((unlock) => unlock.id === "hive:completed-goals:2"),
  },
  {
    id: "goals-3",
    title: "Golden Hive",
    caption: "Complete 3 Goals",
    icon: "crown.fill",
    tier: "gold",
    isUnlocked: (unlocks) =>
      unlocks.some((unlock) => unlock.id === "hive:completed-goals:3"),
  },
  {
    id: "genius",
    title: "Genius Swarm",
    caption: "Every Goal buzzing at once",
    icon: "sparkles",
    tier: "gold",
    secret: true,
    isUnlocked: (unlocks) =>
      unlocks.some((unlock) => unlock.id === "hive:first-genius"),
  },
];

/** Game-style badge case: every badge in the Hive, earned or still waiting. */
export function HiveAchievements({
  achievements,
}: {
  achievements: AchievementSummary[];
}) {
  const theme = useTheme();
  const unlockedCount = BADGES.filter((badge) =>
    badge.isUnlocked(achievements),
  ).length;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.heading}>
        <ThemedText type="smallBold" selectable>
          Achievements
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.tabular}
          selectable
        >
          {unlockedCount}/{BADGES.length}
        </ThemedText>
      </View>
      <View style={styles.grid}>
        {BADGES.map((badge) => (
          <Badge
            key={badge.id}
            badge={badge}
            unlocked={badge.isUnlocked(achievements)}
          />
        ))}
      </View>
    </View>
  );
}

const BADGE_SIZE = 68;

function Badge({
  badge,
  unlocked,
}: {
  badge: BadgeDefinition;
  unlocked: boolean;
}) {
  const theme = useTheme();
  const hidden = badge.secret && !unlocked;
  const tier = TIERS[badge.tier];
  const fill = unlocked ? tier.fill : theme.backgroundElement;
  const stroke = unlocked ? tier.stroke : theme.border;
  const iconTint = unlocked ? tier.icon : theme.textSecondary;
  const title = hidden ? "???" : badge.title;
  const caption = hidden ? "Keep buzzing to reveal" : badge.caption;
  // SAFETY: Badge definitions only store valid SF Symbol names, and SymbolView
  // renders the provided fallback glyph for any name the platform does not know.
  const icon = (hidden ? "questionmark" : unlocked ? badge.icon : "lock.fill") as SymbolViewProps["name"];

  return (
    <View
      accessible
      accessibilityLabel={
        hidden
          ? "Secret achievement, still locked"
          : `${badge.title}, ${badge.caption}, ${unlocked ? "unlocked" : "locked"}`
      }
      style={styles.cell}
    >
      <View style={styles.medallion}>
        <HexMedallion fill={fill} stroke={stroke} />
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.iconCenter}>
            <SymbolView
              name={icon}
              size={24}
              tintColor={iconTint}
              fallback={
                <ThemedText style={{ color: iconTint }}>
                  {hidden ? "?" : "⬡"}
                </ThemedText>
              }
            />
          </View>
        </View>
      </View>
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[styles.title, !unlocked && styles.lockedText]}
        selectable
      >
        {title}
      </ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        numberOfLines={2}
        style={styles.caption}
        selectable
      >
        {caption}
      </ThemedText>
    </View>
  );
}

/** Pointy-top hexagon with an inner accent ring, drawn with Skia. */
function HexMedallion({ fill, stroke }: { fill: string; stroke: string }) {
  const paths = useMemo(() => {
    const hexAt = (radius: number) =>
      makeRoundedPolygonPath(
        Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI / 180) * (60 * i - 90);
          return {
            x: BADGE_SIZE / 2 + radius * Math.cos(angle),
            y: BADGE_SIZE / 2 + radius * Math.sin(angle),
          };
        }),
        7,
      );
    return {
      outer: hexAt(BADGE_SIZE / 2 - 2),
      ring: hexAt(BADGE_SIZE / 2 - 8),
    };
  }, []);

  return (
    <Canvas style={{ width: BADGE_SIZE, height: BADGE_SIZE }}>
      <Path path={paths.outer} color={fill} />
      <Path
        path={paths.outer}
        color={stroke}
        style="stroke"
        strokeWidth={2.5}
      />
      <Path
        path={paths.ring}
        color={stroke}
        style="stroke"
        strokeWidth={1}
        opacity={0.45}
      />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: Spacing.three,
  },
  cell: {
    width: "33.33%",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  medallion: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  },
  iconCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
  },
  lockedText: {
    opacity: 0.6,
  },
  caption: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
