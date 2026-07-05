import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddRow } from '@/components/goals/add-row';
import { ScreenHeader } from '@/components/goals/screen-header';
import { TaskRow } from '@/components/goals/task-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Task = FunctionReturnType<typeof api.tasks.listByProject>[number];

export default function ProjectScreen() {
  const theme = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = projectId as Id<'projects'>;
  const project = useQuery(api.projects.get, { projectId: id });
  const tasks = useQuery(api.tasks.listByProject, { projectId: id });
  const createTask = useMutation(api.tasks.create);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);
  const [subtaskTarget, setSubtaskTarget] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(tasks ?? []), [tasks]);

  const add = async (title: string, parentTaskId?: string) => {
    setSubtaskTarget(null);
    try {
      await createTask({
        projectId: id,
        title,
        parentTaskId: parentTaskId as Id<'tasks'> | undefined,
      });
    } catch (error) {
      Alert.alert('Could not add task', error instanceof Error ? error.message : undefined);
    }
  };

  const confirmDelete = (task: Task) => {
    Alert.alert('Delete task?', `"${task.title}" and its subtasks will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeTask({ taskId: task.id }),
      },
    ]);
  };

  const loading = project === undefined || tasks === undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {loading ? (
            <ActivityIndicator style={styles.loading} />
          ) : project === null ? (
            <View style={styles.missing}>
              <ThemedText themeColor="textSecondary">This project is gone.</ThemedText>
            </View>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <ScreenHeader title={project.title} showBack />
              {tree.open.map(({ task, subtasks }) => (
                <View key={task.id}>
                  <TaskRow
                    task={task}
                    onToggle={() => toggleTask({ taskId: task.id })}
                    onLongPress={() => confirmDelete(task)}
                    onAddSubtask={() =>
                      setSubtaskTarget((current) => (current === task.id ? null : task.id))
                    }
                  />
                  {subtasks.map((subtask) => (
                    <TaskRow
                      key={subtask.id}
                      task={subtask}
                      isSubtask
                      onToggle={() => toggleTask({ taskId: subtask.id })}
                      onLongPress={() => confirmDelete(subtask)}
                    />
                  ))}
                  {subtaskTarget === task.id ? (
                    <View style={styles.subtaskComposer}>
                      <AddRow
                        label="New subtask"
                        onSubmit={(title) => add(title, task.id)}
                        onDismiss={() => setSubtaskTarget(null)}
                        startActive
                        compact
                      />
                    </View>
                  ) : null}
                </View>
              ))}
              <View style={styles.addTask}>
                <AddRow
                  label="New task"
                  onSubmit={(title) => add(title)}
                  dashed={tree.open.length === 0 && tree.done.length === 0}
                />
              </View>
              {tree.done.length > 0 ? (
                <View style={styles.doneSection}>
                  <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    DONE
                  </ThemedText>
                  {tree.done.map(({ task, subtasks }) => (
                    <View key={task.id}>
                      <TaskRow
                        task={task}
                        onToggle={() => toggleTask({ taskId: task.id })}
                        onLongPress={() => confirmDelete(task)}
                      />
                      {subtasks.map((subtask) => (
                        <TaskRow
                          key={subtask.id}
                          task={subtask}
                          isSubtask
                          onToggle={() => toggleTask({ taskId: subtask.id })}
                          onLongPress={() => confirmDelete(subtask)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Groups a flat task list into parent tasks with their subtasks. */
function buildTree(tasks: Task[]) {
  const parents = tasks.filter((task) => task.parentTaskId === null);
  const byParent = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.parentTaskId !== null) {
      const list = byParent.get(task.parentTaskId) ?? [];
      list.push(task);
      byParent.set(task.parentTaskId, list);
    }
  }
  const nodes = parents.map((task) => ({ task, subtasks: byParent.get(task.id) ?? [] }));
  return {
    open: nodes.filter(({ task }) => task.status === 'todo'),
    done: nodes.filter(({ task }) => task.status === 'done'),
  };
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
    paddingBottom: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.four,
  },
  loading: {
    marginTop: Spacing.six,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskComposer: {
    paddingLeft: Spacing.five,
    paddingVertical: Spacing.one,
  },
  addTask: {
    marginTop: Spacing.two,
  },
  doneSection: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
