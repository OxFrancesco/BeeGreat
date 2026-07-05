import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router, useLocalSearchParams } from 'expo-router';
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

import { CombCell } from '@/components/goals/comb-cell';
import { InlineComposer } from '@/components/goals/inline-composer';
import { ScreenHeader } from '@/components/goals/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type GoalDetail = NonNullable<FunctionReturnType<typeof api.goals.get>>;
type ProjectSummary = GoalDetail['projects'][number];

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const goal = useQuery(api.goals.get, { goalId: goalId as Id<'goals'> });
  const createProject = useMutation(api.projects.create);

  const addProject = async (title: string) => {
    try {
      await createProject({ goalId: goalId as Id<'goals'>, title });
    } catch (error) {
      Alert.alert('Could not add project', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {goal === undefined ? (
            <ActivityIndicator style={styles.loading} />
          ) : goal === null ? (
            <View style={styles.missing}>
              <ThemedText themeColor="textSecondary">This goal is gone.</ThemedText>
            </View>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <ScreenHeader title={goal.title} eyebrow="Goal" showBack />
              {goal.finalGoal ? (
                <ThemedText themeColor="textSecondary">{goal.finalGoal}</ThemedText>
              ) : null}
              <View style={styles.section}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  PROJECTS
                </ThemedText>
                {goal.projects.length === 0 ? (
                  <ThemedText themeColor="textSecondary">
                    No projects yet. Add one — each project gets its own bee.
                  </ThemedText>
                ) : (
                  goal.projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))
                )}
                <InlineComposer placeholder="New project…" onSubmit={addProject} compact />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const theme = useTheme();
  const progress = project.totalTasks === 0 ? 0 : project.doneTasks / project.totalTasks;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.title}`}
      onPress={() =>
        router.push({
          pathname: '/goals/project/[projectId]',
          params: { projectId: project.id },
        })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <CombCell size={44} progress={progress} />
      <View style={styles.cardBody}>
        <ThemedText numberOfLines={1}>{project.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {project.totalTasks === 0
            ? 'No tasks yet'
            : `${project.doneTasks} of ${project.totalTasks} tasks done`}
        </ThemedText>
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
  loading: {
    marginTop: Spacing.six,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
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
  cardBody: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
