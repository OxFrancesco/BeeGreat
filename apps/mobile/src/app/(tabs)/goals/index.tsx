import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CombCell } from '@/components/goals/comb-cell';
import { InlineComposer } from '@/components/goals/inline-composer';
import { ScreenHeader } from '@/components/goals/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_GOALS = 3;

type GoalSummary = FunctionReturnType<typeof api.goals.list>[number];

export default function GoalsScreen() {
  const goals = useQuery(api.goals.list);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <ScreenHeader
              title="Goals"
              eyebrow={
                goals ? `${goals.length} of ${MAX_GOALS} combs in use` : 'Loading your combs…'
              }
            />
            <ThemedText themeColor="textSecondary">
              Pick at most three. Everything else waits outside the hive.
            </ThemedText>
            {goals === undefined ? (
              <ActivityIndicator style={styles.loading} />
            ) : (
              <View style={styles.slots}>
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
                {Array.from({ length: Math.max(0, MAX_GOALS - goals.length) }, (_, i) => (
                  <EmptySlot key={`empty-${i}`} first={i === 0} />
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function GoalCard({ goal }: { goal: GoalSummary }) {
  const theme = useTheme();
  const totalTasks = goal.openTasks + goal.doneTasks;
  const progress = totalTasks === 0 ? 0 : goal.doneTasks / totalTasks;
  const meta = [
    `${goal.projectCount} ${goal.projectCount === 1 ? 'project' : 'projects'}`,
    totalTasks === 0 ? 'no tasks yet' : `${goal.openTasks} tasks left`,
  ].join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open goal ${goal.title}`}
      onPress={() =>
        router.push({ pathname: '/goals/[goalId]', params: { goalId: goal.id } })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <CombCell size={52} progress={progress} />
      <View style={styles.cardBody}>
        <ThemedText numberOfLines={1}>{goal.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {meta}
        </ThemedText>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

function EmptySlot({ first }: { first: boolean }) {
  const theme = useTheme();
  const [composing, setComposing] = useState(false);
  const createGoal = useMutation(api.goals.create);

  const submit = async (title: string) => {
    setComposing(false);
    try {
      await createGoal({ title });
    } catch (error) {
      Alert.alert('Could not add goal', error instanceof Error ? error.message : undefined);
    }
  };

  if (composing) {
    return (
      <View style={[styles.card, styles.emptyCard, { borderColor: theme.border }]}>
        <InlineComposer placeholder="Name the goal…" onSubmit={submit} autoFocus />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a goal"
      onPress={() => setComposing(true)}
      style={({ pressed }) => [
        styles.card,
        styles.emptyCard,
        { borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <CombCell size={52} progress={0} />
      <View style={styles.cardBody}>
        <ThemedText themeColor="textSecondary">Empty comb</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {first ? 'Add a goal to start filling it' : 'Waiting for a goal'}
        </ThemedText>
      </View>
      <SymbolView name="plus" size={16} tintColor={theme.textSecondary} />
    </Pressable>
  );
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  loading: {
    marginTop: Spacing.six,
  },
  slots: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  emptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  cardBody: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
