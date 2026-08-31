import { api } from "@beegreat/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { GolieBee } from "@/components/first-focus/golie-bee";
import { HoneyVessel } from "@/components/first-focus/honey-vessel";
import { ScreenHeader } from "@/components/goals/screen-header";
import { CurrencyBar } from "@/components/hive/currency-bar";
import { HiveAchievements } from "@/components/hive/hive-achievements";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MotionDuration } from "@/constants/motion";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  formatHighlightExpiry,
  getStableGolieBeeSeed,
} from "@/lib/first-focus";
import { useScreenshotFixture } from "@/lib/screenshot-fixture";

export type FirstFocusState = FunctionReturnType<typeof api.firstFocus.getCurrent>;
type Completion = FunctionReturnType<typeof api.firstFocus.completeHighlight>;
type ActiveGoal = FirstFocusState["activeGoals"][number];
export type CompletionContext = {
  result: Completion;
  goal: ActiveGoal | null;
  highlightTitle: string;
};
type CompleteHighlight = (
  args: FunctionArgs<typeof api.firstFocus.completeHighlight>,
) => Promise<Completion>;

export default function HiveScreen() {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return (
      <HiveScreenView
        current={fixture.hive}
        onCompleteHighlight={async () => fixture.hiveCompletion.result}
      />
    );
  }

  return (
    <HiveErrorBoundary>
      <LiveHiveContent />
    </HiveErrorBoundary>
  );
}

function LiveHiveContent() {
  const current = useQuery(api.firstFocus.getCurrent, {});
  const completeHighlight = useMutation(api.firstFocus.completeHighlight);

  return (
    <HiveScreenView
      current={current}
      onCompleteHighlight={completeHighlight}
    />
  );
}

export function HiveScreenView({
  current,
  initialCompletion,
  onCompleteHighlight,
}: {
  current: FirstFocusState | undefined;
  initialCompletion?: CompletionContext;
  onCompleteHighlight: CompleteHighlight;
}) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <ScreenHeader title="Hive" />
            <CurrencyBar />
          </View>
          {current === undefined ? (
            <HiveLoading />
          ) : (
            <HiveDashboard
              current={current}
              initialCompletion={initialCompletion}
              onCompleteHighlight={onCompleteHighlight}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HiveDashboard({
  current,
  initialCompletion,
  onCompleteHighlight,
}: {
  current: FirstFocusState;
  initialCompletion?: CompletionContext;
  onCompleteHighlight: CompleteHighlight;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [completion, setCompletion] = useState<CompletionContext | null>(
    initialCompletion ?? null,
  );
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const highlight = current.activeHighlight;
  const highlightedGoal = highlight
    ? current.activeGoals.find((goal) => goal.goalId === highlight.goalId)
    : undefined;
  const displayedGoal = completion
    ? completion.goal
    : (highlightedGoal ?? current.activeGoals[0]);

  const complete = async () => {
    if (!highlight || completing) return;
    setCompleting(true);
    setError(null);
    try {
      const result = await onCompleteHighlight({
        requestId: `complete-highlight:${highlight.highlightId}`,
        taskId: highlight.taskId,
      });
      setCompletion({
        result,
        goal: highlightedGoal ?? null,
        highlightTitle: highlight.title,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This Highlight could not be completed.",
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={styles.dashboard}>
      <HoneyVessel balance={current.hive.honeyBalance} />

      {completion ? (
        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeInDown.duration(MotionDuration.progress)
          }
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          style={[
            styles.celebration,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <SymbolView
            name="sparkles"
            size={28}
            tintColor="#D78A00"
            fallback={<ThemedText type="subtitle">✦</ThemedText>}
          />
          <View style={styles.flex}>
            <ThemedText type="smallBold" selectable>
              {completion.goal
                ? `${completion.goal.title} moved forward`
                : `${completion.highlightTitle} is complete`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" selectable>
              +{completion.result.honeyAwarded} Honey · +
              {completion.result.scoreAwarded} Honeycomb Score
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {highlight ? (
        <View
          style={[styles.highlightCard, { backgroundColor: theme.secondary }]}
        >
          <View
            accessible
            accessibilityLabel={`Current Highlight: ${highlight.title}, expires ${formatHighlightExpiry(highlight.expiresAt)}`}
            style={styles.highlightRow}
          >
            <View style={styles.highlightContent}>
              <ThemedText
                type="small"
                themeColor="secondaryForeground"
                style={styles.highlightMeta}
                selectable
              >
                Highlight · until {formatHighlightExpiry(highlight.expiresAt)}
              </ThemedText>
              <ThemedText
                type="subtitle"
                themeColor="secondaryForeground"
                style={styles.highlightTitle}
                selectable
              >
                {highlight.title}
              </ThemedText>
              {highlightedGoal ? (
                <ThemedText
                  type="small"
                  themeColor="secondaryForeground"
                  style={styles.highlightMeta}
                  selectable
                >
                  For {highlightedGoal.title}
                </ThemedText>
              ) : null}
            </View>
            {displayedGoal?.golieBee ? (
              <GolieBee
                compact
                seed={getStableGolieBeeSeed(
                  displayedGoal.golieBee,
                  displayedGoal.golieBee.golieBeeId,
                )}
                celebrating={Boolean(completion)}
              />
            ) : null}
          </View>
          {error ? (
            <ThemedText
              accessibilityRole="alert"
              type="small"
              themeColor="destructive"
              selectable
            >
              {error}
            </ThemedText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Complete Highlight ${highlight.title}`}
            accessibilityHint="Awards progress to your Hive and GolieBee"
            accessibilityState={{ busy: completing, disabled: completing }}
            disabled={completing}
            onPress={complete}
            style={({ pressed }) => [
              styles.completeButton,
              { backgroundColor: theme.primary },
              completing && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name="checkmark"
              size={17}
              tintColor={theme.primaryForeground}
              fallback={null}
            />
            <ThemedText
              type="smallBold"
              style={{ color: theme.primaryForeground }}
            >
              {completing ? "Completing…" : "Complete Highlight"}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <NoHighlight hasGoals={current.activeGoals.length > 0} />
      )}

      <HiveAchievements achievements={current.economy.achievements} />
    </View>
  );
}

function NoHighlight({ hasGoals }: { hasGoals: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.emptyCard, { borderColor: theme.border }]}>
      <View
        style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}
      >
        <SymbolView
          name="scope"
          size={24}
          tintColor={theme.textSecondary}
          fallback={null}
        />
      </View>
      <ThemedText type="smallBold" selectable>
        {hasGoals ? "Choose your next Highlight" : "Create your first focus"}
      </ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.centered}
        selectable
      >
        {hasGoals
          ? "Ask Bee to point your attention at one meaningful next step."
          : "Tell Bee what outcome matters, then review the plan before anything is created."}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Talk to Bee about your focus"
        onPress={() => router.navigate("/")}
        style={({ pressed }) => [
          styles.talkButton,
          { borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold">Talk to Bee</ThemedText>
      </Pressable>
    </View>
  );
}

function HiveLoading() {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading your Hive" style={styles.loading}>
      <ActivityIndicator color={theme.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        Gathering your Hive…
      </ThemedText>
    </View>
  );
}

type HiveErrorBoundaryState = { error: Error | null; retryKey: number };

class HiveErrorBoundary extends Component<
  { children: ReactNode },
  HiveErrorBoundaryState
> {
  state: HiveErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The user-facing state below is sufficient; Convex reports the original error in development.
  }

  render() {
    if (!this.state.error) {
      return (
        <View key={this.state.retryKey} style={styles.errorBoundaryChild}>
          {this.props.children}
        </View>
      );
    }
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View accessibilityRole="alert" style={styles.errorState}>
            <ThemedText type="subtitle" selectable>
              The Hive is out of reach
            </ThemedText>
            <ThemedText
              themeColor="textSecondary"
              style={styles.centered}
              selectable
            >
              Check your connection and try gathering it again.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading the Hive"
              onPress={() =>
                this.setState((state) => ({
                  error: null,
                  retryKey: state.retryKey + 1,
                }))
              }
              style={styles.retryButton}
            >
              <ThemedText type="smallBold" style={styles.retryLabel}>
                Try again
              </ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  dashboard: {
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  celebration: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: "continuous",
    padding: Spacing.three,
  },
  highlightCard: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  highlightContent: {
    flex: 1,
    gap: Spacing.two,
  },
  highlightMeta: {
    opacity: 0.8,
  },
  highlightTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  completeButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 24,
  },
  emptyCard: {
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderRadius: 22,
    borderCurve: "continuous",
    padding: Spacing.five,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
  },
  talkButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 21,
    paddingHorizontal: Spacing.four,
  },
  loading: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },
  errorBoundaryChild: {
    flex: 1,
  },
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  retryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#644a40",
    paddingHorizontal: Spacing.four,
  },
  retryLabel: {
    color: "#ffffff",
  },
  flex: {
    flex: 1,
  },
  centered: {
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.68,
  },
});
