import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type BrainFatigueSummary = {
  isActive: boolean;
  dailyHoneyDrain: number;
  affectedGoalCount: number;
  rank: number;
};

export type GeniusStateSummary = {
  isActive: boolean;
  verifiedGoalCount: number;
  requiredGoalCount: number;
};

export type FocusShieldSummary = {
  goalTitle: string;
  expiresAt: number;
};

export type AchievementSummary = {
  id: string;
  title: string;
  kind: "goliebee" | "hive";
  rank?: number;
};

export type HiveEconomyStoryProps = {
  honeycombScore: number;
  royalJellyBalance: number;
  activeGoalCount: number;
  brainFatigue?: BrainFatigueSummary;
  geniusState?: GeniusStateSummary;
  activeFocusShield?: FocusShieldSummary | null;
  achievements?: AchievementSummary[];
  achievementCount?: number;
};

const DEFAULT_GENIUS_GOAL_COUNT = 7;

export function HiveEconomyStory({
  honeycombScore,
  royalJellyBalance,
  activeGoalCount,
  brainFatigue,
  geniusState,
  activeFocusShield,
  achievements = [],
  achievementCount = achievements.length,
}: HiveEconomyStoryProps) {
  const theme = useTheme();
  const geniusRequired = Math.max(
    geniusState?.requiredGoalCount ?? DEFAULT_GENIUS_GOAL_COUNT,
    1,
  );
  const geniusVerified = Math.min(
    Math.max(geniusState?.verifiedGoalCount ?? 0, 0),
    geniusRequired,
  );
  const geniusProgress = geniusVerified / geniusRequired;
  const recentAchievements = achievements.slice(0, 3);
  const status = getHiveStatus(
    brainFatigue,
    geniusState?.isActive ?? false,
    activeGoalCount,
  );

  return (
    <View style={styles.story}>
      <View style={styles.resourceRow}>
        <ResourcePill
          icon="hexagon.fill"
          tint="#D78A00"
          label="Honeycomb Score"
          value={honeycombScore}
        />
        <ResourcePill
          icon="drop.fill"
          tint="#C85682"
          label="Royal Jelly"
          value={royalJellyBalance}
        />
      </View>

      <View
        style={[
          styles.rhythmCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={styles.rhythmHeader}>
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor:
                  geniusState?.isActive || !brainFatigue?.isActive
                    ? theme.secondary
                    : theme.backgroundElement,
              },
            ]}
          >
            <SymbolView
              name={
                geniusState?.isActive
                  ? "sparkles"
                  : brainFatigue?.isActive
                    ? "brain.head.profile"
                    : "waveform"
              }
              size={21}
              tintColor={
                geniusState?.isActive ? theme.secondaryForeground : "#D78A00"
              }
              fallback={null}
            />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              HIVE RHYTHM
            </ThemedText>
            <ThemedText style={styles.statusTitle} selectable>
              {status.title}
            </ThemedText>
          </View>
          <View
            style={[
              styles.goalCount,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <ThemedText type="smallBold" style={styles.tabular} selectable>
              {activeGoalCount}/7
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary" selectable>
          {status.detail}
        </ThemedText>

        <View style={styles.geniusBlock}>
          <View style={styles.progressCopy}>
            <ThemedText type="smallBold" selectable>
              Genius flight
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.tabular}
              selectable
            >
              {geniusVerified} of {geniusRequired} Goals verified
            </ThemedText>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Genius State weekly progress"
            accessibilityValue={{
              min: 0,
              max: geniusRequired,
              now: geniusVerified,
              text: `${geniusVerified} of ${geniusRequired} Goals verified`,
            }}
            style={[
              styles.progressTrack,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: geniusState?.isActive
                    ? "#D78A00"
                    : theme.primary,
                  width: `${Math.round(geniusProgress * 100)}%`,
                },
              ]}
            />
          </View>
        </View>

        {activeFocusShield ? (
          <View
            accessible
            style={[styles.powerBee, { backgroundColor: theme.secondary }]}
            accessibilityLabel={`Focus Shield PowerBee is protecting ${activeFocusShield.goalTitle} ${formatShieldExpiry(activeFocusShield.expiresAt)}`}
          >
            <View style={styles.powerBeeIcon}>
              <SymbolView
                name="shield.fill"
                size={18}
                tintColor={theme.secondaryForeground}
                fallback={null}
              />
              <ThemedText style={styles.miniBee} accessibilityElementsHidden>
                🐝
              </ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText
                type="smallBold"
                themeColor="secondaryForeground"
                selectable
              >
                Focus Shield PowerBee on duty
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="secondaryForeground"
                selectable
              >
                Protecting {activeFocusShield.goalTitle} ·{" "}
                {formatShieldExpiry(activeFocusShield.expiresAt)}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.achievementTrail, { borderColor: theme.border }]}>
        <View style={styles.achievementHeading}>
          <View style={styles.headingCopy}>
            <SymbolView
              name="rosette"
              size={18}
              tintColor="#D78A00"
              fallback={null}
            />
            <ThemedText type="smallBold" selectable>
              Achievements
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.tabular}
            selectable
          >
            {achievementCount} unlocked
          </ThemedText>
        </View>

        {recentAchievements.length > 0 ? (
          <View style={styles.badgeRow}>
            {recentAchievements.map((achievement) => (
              <View
                key={achievement.id}
                accessible
                style={[
                  styles.badge,
                  { backgroundColor: theme.backgroundElement },
                ]}
                accessibilityLabel={`${achievement.title}${achievement.rank ? `, ${achievement.rank}` : ""}, ${achievement.kind} achievement`}
              >
                <SymbolView
                  name={
                    achievement.kind === "hive" ? "hexagon.fill" : "seal.fill"
                  }
                  size={16}
                  tintColor="#D78A00"
                  fallback={null}
                />
                <ThemedText type="small" numberOfLines={1} selectable>
                  {achievement.title}
                  {achievement.rank ? ` · ${achievement.rank}` : ""}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" selectable>
            Your first verified step will wake the first badge.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function ResourcePill({
  icon,
  tint,
  label,
  value,
}: {
  icon: "drop.fill" | "hexagon.fill";
  tint: string;
  label: string;
  value: number;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={[
        styles.resourcePill,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <SymbolView name={icon} size={19} tintColor={tint} fallback={null} />
      <View style={styles.flex}>
        <ThemedText style={styles.resourceValue} selectable>
          {formatCount(value)}
        </ThemedText>
        <ThemedText
          type="small"
          themeColor="textSecondary"
          numberOfLines={1}
          selectable
        >
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

function getHiveStatus(
  fatigue: BrainFatigueSummary | undefined,
  geniusActive: boolean,
  activeGoalCount: number,
) {
  if (geniusActive) {
    return {
      title: "Genius State",
      detail:
        "Every active Goal has recent verified progress. Brain Fatigue is quiet.",
    };
  }

  if (fatigue?.isActive) {
    const affected =
      fatigue.affectedGoalCount === 1
        ? "1 Goal"
        : `${fatigue.affectedGoalCount} Goals`;
    return {
      title: `Brain Fatigue · Rank ${fatigue.rank}`,
      detail: `${affected} share a ${fatigue.dailyHoneyDrain} Honey daily drain. No drain can create debt.`,
    };
  }

  return {
    title: activeGoalCount === 0 ? "A quiet Hive" : "A steady Hive",
    detail:
      activeGoalCount > 0
        ? "Your active Goals are within the healthy focus range."
        : "Add a Goal to bring its first GolieBee home.",
  };
}

function formatShieldExpiry(expiresAt: number) {
  if (!Number.isFinite(expiresAt)) return "active now";

  return `until ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(expiresAt))}`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

const styles = StyleSheet.create({
  story: {
    gap: Spacing.two,
  },
  resourceRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  resourcePill: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  resourceValue: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  rhythmCard: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  rhythmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  statusIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  statusTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "700",
  },
  goalCount: {
    minWidth: 48,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingHorizontal: Spacing.two,
  },
  geniusBlock: {
    gap: Spacing.two,
  },
  progressCopy: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
  },
  progressFill: {
    height: "100%",
    minWidth: 0,
    borderRadius: 4,
  },
  powerBee: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: 18,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  powerBeeIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  miniBee: {
    position: "absolute",
    right: -5,
    bottom: -6,
    fontSize: 15,
    lineHeight: 18,
  },
  achievementTrail: {
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  achievementHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  headingCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  badge: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
