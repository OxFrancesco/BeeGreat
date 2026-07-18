import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
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
import { ScreenHeader } from '@/components/goals/screen-header';
import { TaskRow } from '@/components/goals/task-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useScreenshotFixture } from '@/lib/screenshot-fixture';

type Task = FunctionReturnType<typeof api.tasks.listByProject>[number];
type Project = FunctionReturnType<typeof api.projects.get>;
type ProjectDue = { year: number; quarter?: number } | null;

/** End of the given day in local time, as epoch millis. */
function endOfDayIn(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function formatProjectDue(due: ProjectDue) {
  if (!due) return null;
  return due.quarter ? `Q${due.quarter} ${due.year}` : `${due.year}`;
}

/** The next four quarters starting from the current one. */
function upcomingQuarters(): { year: number; quarter: number }[] {
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;
  return Array.from({ length: 4 }, () => {
    const entry = { year, quarter };
    quarter += 1;
    if (quarter > 4) {
      quarter = 1;
      year += 1;
    }
    return entry;
  });
}

export default function ProjectScreen() {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return (
      <ProjectScreenView
        project={fixture.project}
        tasks={fixture.tasks}
        highlightTaskId={fixture.hive.activeHighlight?.taskId ?? null}
        onAddTask={async () => {}}
        onToggleTask={() => {}}
        onOpenTaskActions={() => {}}
        onOpenProjectSettings={() => {}}
        onPickProjectDue={() => {}}
      />
    );
  }

  return <LiveProjectScreen />;
}

function LiveProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = projectId as Id<'projects'>;
  const project = useQuery(api.projects.get, { projectId: id });
  const tasks = useQuery(api.tasks.listByProject, { projectId: id });
  const firstFocus = useQuery(api.firstFocus.getCurrent, {});
  const createTask = useMutation(api.tasks.create);
  const toggleTask = useMutation(api.tasks.toggle);
  const removeTask = useMutation(api.tasks.remove);
  const renameTask = useMutation(api.tasks.update);
  const setTaskDueDate = useMutation(api.tasks.setDueDate);
  const setProjectDue = useMutation(api.projects.setDue);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const add = async (title: string, parentTaskId?: string) => {
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

  const pickDueDate = (task: Task) => {
    Alert.alert('Due date', `When is "${task.title}" due?`, [
      { text: 'Today', onPress: () => setTaskDueDate({ taskId: task.id, dueDate: endOfDayIn(0) }) },
      {
        text: 'Tomorrow',
        onPress: () => setTaskDueDate({ taskId: task.id, dueDate: endOfDayIn(1) }),
      },
      {
        text: 'Next week',
        onPress: () => setTaskDueDate({ taskId: task.id, dueDate: endOfDayIn(7) }),
      },
      {
        text: 'In two weeks',
        onPress: () => setTaskDueDate({ taskId: task.id, dueDate: endOfDayIn(14) }),
      },
      ...(task.dueDate !== null
        ? [
            {
              text: 'Remove due date',
              style: 'destructive' as const,
              onPress: () => setTaskDueDate({ taskId: task.id, dueDate: null }),
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Long-press opens the task's actions: rename + due date + delete.
  const openTaskActions = (task: Task) => {
    Alert.alert(task.title, undefined, [
      {
        text: 'Rename',
        onPress: () =>
          Alert.prompt(
            'Rename task',
            undefined,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: (title?: string) => {
                  if (title?.trim()) renameTask({ taskId: task.id, title });
                },
              },
            ],
            'plain-text',
            task.title,
          ),
      },
      { text: 'Set due date…', onPress: () => pickDueDate(task) },
      { text: 'Delete task', style: 'destructive', onPress: () => confirmDelete(task) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Gear menu: rename or delete the whole project.
  const openProjectSettings = () => {
    if (!project) return;
    Alert.alert(project.title, undefined, [
      {
        text: 'Rename',
        onPress: () =>
          Alert.prompt(
            'Rename project',
            undefined,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Save',
                onPress: (title?: string) => {
                  if (title?.trim()) updateProject({ projectId: id, title });
                },
              },
            ],
            'plain-text',
            project.title,
          ),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete project?',
            `"${project.title}" and all of its tasks will be gone for good.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await removeProject({ projectId: id });
                  router.back();
                },
              },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickProjectDue = () => {
    if (!project) return;
    const thisYear = new Date().getFullYear();
    Alert.alert('Target date', 'When should this project land?', [
      ...upcomingQuarters().map((entry) => ({
        text: `Q${entry.quarter} ${entry.year}`,
        onPress: () => setProjectDue({ projectId: id, due: entry }),
      })),
      { text: `${thisYear}`, onPress: () => setProjectDue({ projectId: id, due: { year: thisYear } }) },
      {
        text: `${thisYear + 1}`,
        onPress: () => setProjectDue({ projectId: id, due: { year: thisYear + 1 } }),
      },
      ...(project.due
        ? [
            {
              text: 'Remove target',
              style: 'destructive' as const,
              onPress: () => setProjectDue({ projectId: id, due: null }),
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  return (
    <ProjectScreenView
      project={project}
      tasks={tasks}
      highlightTaskId={firstFocus?.activeHighlight?.taskId ?? null}
      onAddTask={add}
      onToggleTask={(task) => toggleTask({ taskId: task.id })}
      onOpenTaskActions={openTaskActions}
      onOpenProjectSettings={openProjectSettings}
      onPickProjectDue={pickProjectDue}
    />
  );
}

export function ProjectScreenView({
  project,
  tasks,
  highlightTaskId,
  onAddTask,
  onToggleTask,
  onOpenTaskActions,
  onOpenProjectSettings,
  onPickProjectDue,
}: {
  project: Project | undefined;
  tasks: Task[] | undefined;
  highlightTaskId: string | null;
  onAddTask: (title: string, parentTaskId?: string) => void | Promise<void>;
  onToggleTask: (task: Task) => void;
  onOpenTaskActions: (task: Task) => void;
  onOpenProjectSettings: () => void;
  onPickProjectDue: () => void;
}) {
  const theme = useTheme();
  const [subtaskTarget, setSubtaskTarget] = useState<string | null>(null);
  const tree = useMemo(() => buildTree(tasks ?? []), [tasks]);
  const loading = project === undefined || tasks === undefined;

  const add = async (title: string, parentTaskId?: string) => {
    setSubtaskTarget(null);
    await onAddTask(title, parentTaskId);
  };

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
              <ScreenHeader
                title={project.title}
                showBack
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Project settings"
                    hitSlop={Spacing.two}
                    onPress={onOpenProjectSettings}
                    style={({ pressed }) => pressed && styles.duePressed}
                  >
                    <SymbolView
                      name="gearshape"
                      size={20}
                      tintColor={theme.textSecondary}
                      fallback={<ThemedText themeColor="textSecondary">…</ThemedText>}
                    />
                  </Pressable>
                }
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Set project target date"
                onPress={onPickProjectDue}
                style={({ pressed }) => [
                  styles.dueChip,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  pressed && styles.duePressed,
                ]}
              >
                <ThemedText type="small" themeColor={project.due ? 'text' : 'textSecondary'}>
                  {project.due
                    ? `Target: ${formatProjectDue(project.due)}`
                    : 'Set a target date (quarter or year)'}
                </ThemedText>
              </Pressable>
              {tree.open.map(({ task, subtasks }) => (
                <View key={task.id}>
                  <TaskRow
                    task={task}
                    highlighted={task.id === highlightTaskId}
                    onToggle={() => onToggleTask(task)}
                    onLongPress={() => onOpenTaskActions(task)}
                    onAddSubtask={() =>
                      setSubtaskTarget((current) => (current === task.id ? null : task.id))
                    }
                  />
                  {subtasks.map((subtask) => (
                    <TaskRow
                      key={subtask.id}
                      task={subtask}
                      highlighted={subtask.id === highlightTaskId}
                      isSubtask
                      onToggle={() => onToggleTask(subtask)}
                      onLongPress={() => onOpenTaskActions(subtask)}
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
                        highlighted={task.id === highlightTaskId}
                        onToggle={() => onToggleTask(task)}
                        onLongPress={() => onOpenTaskActions(task)}
                      />
                      {subtasks.map((subtask) => (
                        <TaskRow
                          key={subtask.id}
                          task={subtask}
                          highlighted={subtask.id === highlightTaskId}
                          isSubtask
                          onToggle={() => onToggleTask(subtask)}
                          onLongPress={() => onOpenTaskActions(subtask)}
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
  dueChip: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.two,
  },
  duePressed: {
    opacity: 0.7,
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
