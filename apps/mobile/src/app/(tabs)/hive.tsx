import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GolieBee } from '@/components/first-focus/golie-bee';
import { HoneyVessel } from '@/components/first-focus/honey-vessel';
import { ScreenHeader } from '@/components/goals/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatHighlightExpiry, getStableGolieBeeSeed } from '@/lib/first-focus';

type FirstFocusState = FunctionReturnType<typeof api.firstFocus.getCurrent>;
type Completion = FunctionReturnType<typeof api.firstFocus.completeHighlight>;
type ActiveGoal = FirstFocusState['activeGoals'][number];
type CompletionContext = {
  result: Completion;
  goal: ActiveGoal | null;
  highlightTitle: string;
};

export default function HiveScreen() {
  return (
    <HiveErrorBoundary>
      <HiveContent />
    </HiveErrorBoundary>
  );
}

function HiveContent() {
  const current = useQuery(api.firstFocus.getCurrent, {});

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader title="Hive" />
          {current === undefined ? <HiveLoading /> : <HiveDashboard current={current} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HiveDashboard({ current }: { current: FirstFocusState }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const completeHighlight = useMutation(api.firstFocus.completeHighlight);
  const [completion, setCompletion] = useState<CompletionContext | null>(null);
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
      const result = await completeHighlight({
        requestId: `complete-highlight:${highlight.highlightId}`,
        taskId: highlight.taskId as Id<'tasks'>,
      });
      setCompletion({
        result,
        goal: highlightedGoal ?? null,
        highlightTitle: highlight.title,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This Highlight could not be completed.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <View style={styles.dashboard}>
      <HoneyVessel balance={current.hive.honeyBalance} />

      <View style={styles.metrics} accessibilityLabel="Hive balances">
        <Metric
          label="Honeycomb Score"
          value={current.hive.honeycombScore}
          icon="hexagon.fill"
          accessibilityLabel={`Honeycomb Score ${current.hive.honeycombScore}`}
        />
      </View>

      {completion ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(240)}
          accessibilityRole="summary"
          accessibilityLiveRegion="polite"
          style={[styles.celebration, { backgroundColor: theme.secondary }]}
        >
          <SymbolView
            name="sparkles"
            size={28}
            tintColor={theme.secondaryForeground}
            fallback={
              <ThemedText type="subtitle" themeColor="secondaryForeground">
                ✦
              </ThemedText>
            }
          />
          <View style={styles.flex}>
            <ThemedText type="smallBold" themeColor="secondaryForeground" selectable>
              {completion.goal
                ? `${completion.goal.title} moved forward`
                : `${completion.highlightTitle} is complete`}
            </ThemedText>
            <ThemedText type="small" themeColor="secondaryForeground" selectable>
              +{completion.result.honeyAwarded} Honey · +{completion.result.scoreAwarded}{' '}
              Honeycomb Score
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {highlight ? (
        <View
          style={[styles.highlightCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View
            accessible
            accessibilityLabel={`Current Highlight: ${highlight.title}, expires ${formatHighlightExpiry(highlight.expiresAt)}`}
            style={styles.highlightContent}
          >
            <View style={styles.eyebrowRow}>
              <View style={[styles.liveDot, { backgroundColor: '#FAB52A' }]} />
              <ThemedText type="smallBold" themeColor="textSecondary">
                CURRENT HIGHLIGHT
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.expiry} selectable>
                {formatHighlightExpiry(highlight.expiresAt)}
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.highlightTitle} selectable>
              {highlight.title}
            </ThemedText>
            {highlightedGoal ? (
              <ThemedText type="small" themeColor="textSecondary" selectable>
                For {highlightedGoal.title}
              </ThemedText>
            ) : null}
          </View>
          {error ? (
            <ThemedText accessibilityRole="alert" type="small" themeColor="destructive" selectable>
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
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              {completing ? 'Completing…' : 'Complete Highlight'}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <NoHighlight hasGoals={current.activeGoals.length > 0} />
      )}

      {displayedGoal?.golieBee ? (
        <View
          style={[styles.golieCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <GolieBee
            seed={getStableGolieBeeSeed(
              displayedGoal.golieBee,
              displayedGoal.golieBee.golieBeeId,
            )}
            celebrating={Boolean(completion)}
          />
          <View style={styles.golieCopy}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              GROWING WITH
            </ThemedText>
            <ThemedText style={styles.goalTitle} selectable>
              {displayedGoal.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" selectable>
              {completion
                ? 'This GolieBee is buzzing with the progress you just made.'
                : 'Every verified step helps this GolieBee and your whole Hive grow.'}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {!completion && current.latestVerifiedProgress ? (
        <View style={[styles.historyCard, { borderColor: theme.border }]}>
          <SymbolView name="clock.arrow.circlepath" size={18} tintColor={theme.textSecondary} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" selectable>
              Latest verified progress
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" selectable>
              +{current.latestVerifiedProgress.honeyDelta} Honey · +
              {current.latestVerifiedProgress.scoreDelta} score
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  accessibilityLabel,
}: {
  label: string;
  value: number;
  icon: SymbolViewProps['name'];
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.metric, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <SymbolView name={icon} size={17} tintColor="#D78A00" fallback={null} />
      <View>
        <ThemedText style={styles.metricValue} selectable>
          {value}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

function NoHighlight({ hasGoals }: { hasGoals: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.emptyCard, { borderColor: theme.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name="scope" size={24} tintColor={theme.textSecondary} fallback={null} />
      </View>
      <ThemedText type="smallBold" selectable>
        {hasGoals ? 'Choose your next Highlight' : 'Create your first focus'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered} selectable>
        {hasGoals
          ? 'Ask Bee to point your attention at one meaningful next step.'
          : 'Tell Bee what outcome matters, then review the plan before anything is created.'}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Talk to Bee about your focus"
        onPress={() => router.navigate('/')}
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

class HiveErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; retryKey: number }
> {
  state = { error: null as Error | null, retryKey: 0 };

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
            <ThemedText themeColor="textSecondary" style={styles.centered} selectable>
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  dashboard: {
    gap: Spacing.three,
  },
  metrics: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metric: {
    flex: 1,
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  celebration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  highlightCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  highlightContent: {
    gap: Spacing.two,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expiry: {
    flex: 1,
    textAlign: 'right',
  },
  highlightTitle: {
    fontSize: 30,
    lineHeight: 36,
  },
  completeButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 24,
    marginTop: Spacing.one,
  },
  golieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  golieCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  goalTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 22,
    borderCurve: 'continuous',
    padding: Spacing.five,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  talkButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 21,
    paddingHorizontal: Spacing.four,
  },
  loading: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  errorBoundaryChild: {
    flex: 1,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#644a40',
    paddingHorizontal: Spacing.four,
  },
  retryLabel: {
    color: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.68,
  },
});
