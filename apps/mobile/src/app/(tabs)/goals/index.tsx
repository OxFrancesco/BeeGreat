import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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

import { AddRow } from '@/components/goals/add-row';
import { CombCell } from '@/components/goals/comb-cell';
import { ScreenHeader } from '@/components/goals/screen-header';
import { CurrencyBar } from '@/components/hive/currency-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MAX_GOALS = 3;

type GoalSummary = FunctionReturnType<typeof api.goals.list>[number];

export default function GoalsScreen() {
  const goals = useQuery(api.goals.list);
  const createGoal = useMutation(api.goals.create);

  const addGoal = async (title: string) => {
    try {
      await createGoal({ title });
    } catch (error) {
      Alert.alert('Could not add goal', error instanceof Error ? error.message : undefined);
    }
  };

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
            <View style={styles.headerRow}>
              <ScreenHeader title="Goals" />
              <CurrencyBar />
            </View>
            {goals === undefined ? (
              <ActivityIndicator style={styles.loading} />
            ) : (
              <View style={styles.slots}>
                {goals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
                {goals.length < MAX_GOALS ? (
                  <AddRow label="New goal" onSubmit={addGoal} dashed />
                ) : null}
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
  const updateGoal = useMutation(api.goals.update);
  const removeGoal = useMutation(api.goals.remove);
  const totalTasks = goal.openTasks + goal.doneTasks;
  const progress = totalTasks === 0 ? 0 : goal.doneTasks / totalTasks;
  const meta =
    totalTasks === 0 ? null : goal.openTasks === 0 ? 'All tasks done' : `${goal.openTasks} ${goal.openTasks === 1 ? 'task' : 'tasks'} left`;

  const rename = () => {
    Alert.prompt(
      'Rename goal',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (title?: string) => {
            if (title?.trim()) updateGoal({ goalId: goal.id, title });
          },
        },
      ],
      'plain-text',
      goal.title,
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete goal?',
      `"${goal.title}" and all of its projects and tasks will be gone for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => removeGoal({ goalId: goal.id }),
        },
      ],
    );
  };

  const showOptions = () => {
    Alert.alert(goal.title, undefined, [
      { text: 'Rename', onPress: rename },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open goal ${goal.title}`}
      onPress={() => router.push({ pathname: '/goals/[goalId]', params: { goalId: goal.id } })}
      onLongPress={showOptions}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <CombCell size={52} progress={progress} />
      <View style={styles.cardBody}>
        <ThemedText numberOfLines={1}>{goal.title}</ThemedText>
        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={theme.textSecondary} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  loading: {
    marginTop: Spacing.six,
  },
  slots: {
    gap: Spacing.three,
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
  cardBody: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
