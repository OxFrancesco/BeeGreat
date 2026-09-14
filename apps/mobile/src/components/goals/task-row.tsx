import { platformSymbol } from '@/components/platform-symbol';
import { useTaskUpdates } from '@/hooks/use-task-updates';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { MotionEasing, MotionScale } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TaskItem = {
  id: string;
  title: string;
  status: 'todo' | 'done';
  dueDate: number | null;
  labels: string[];
};

const Honey = '#FAB52A';

function formatDueDate(dueDate: number) {
  return new Date(dueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** One row of the project to-do list; subtasks render indented and smaller. */
export function TaskRow({
  task,
  isSubtask,
  highlighted,
  onToggle,
  onLongPress,
  onAddSubtask,
}: {
  task: TaskItem;
  isSubtask?: boolean;
  highlighted?: boolean;
  onToggle: () => unknown | Promise<unknown>;
  onLongPress: () => void;
  onAddSubtask?: () => void;
}) {
  const theme = useTheme();
  const updates = useTaskUpdates();
  const state = updates.states[task.id];
  const pending = state === 'pending';
  // Snapshot mount time; overdue state only needs day-level accuracy.
  const [now] = useState(() => Date.now());
  const done = task.status === 'done';
  const overdue = !done && task.dueDate !== null && task.dueDate < now;
  const reducedMotion = useReducedMotion();
  const iconProgress = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    iconProgress.value = withTiming(done ? 1 : 0, {
      duration: 120,
      easing: MotionEasing.out,
    });
    return () => cancelAnimation(iconProgress);
  }, [done, iconProgress]);

  const todoIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - iconProgress.value,
    transform: [
      {
        scale: reducedMotion
          ? 1
          : MotionScale.pressed + 0.03 * (1 - iconProgress.value),
      },
    ],
  }));
  const doneIconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [
      {
        scale: reducedMotion
          ? 1
          : MotionScale.pressed + 0.03 * iconProgress.value,
      },
    ],
  }));

  const toggle = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    void updates.run(task.id, onToggle);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${done ? 'Reopen' : 'Complete'} task ${task.title}${highlighted ? ', current Highlight' : ''}${state === 'failed' ? ', update failed. Tap to retry' : pending ? ', saving' : ''}`}
      accessibilityState={{ disabled: pending, busy: pending }}
      disabled={pending}
      onPress={toggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        isSubtask && styles.subtaskRow,
        pressed && styles.pressed,
      ]}
    >
      <View
        accessibilityElementsHidden
        pointerEvents="none"
        style={{ width: isSubtask ? 18 : 22, height: isSubtask ? 18 : 22 }}
      >
        <Animated.View style={[styles.iconLayer, todoIconStyle]}>
          <SymbolView
            name={platformSymbol('circle')}
            size={isSubtask ? 18 : 22}
            tintColor={theme.textSecondary}
          />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, doneIconStyle]}>
          <SymbolView
            name={platformSymbol('checkmark.circle.fill')}
            size={isSubtask ? 18 : 22}
            tintColor={Honey}
          />
        </Animated.View>
      </View>
      <View style={styles.body}>
        <ThemedText
          type={isSubtask ? 'small' : 'default'}
          themeColor={done ? 'textSecondary' : 'text'}
          style={done && styles.done}
        >
          {task.title}
        </ThemedText>
        {state ? (
          <ThemedText
            accessibilityLiveRegion="polite"
            type="small"
            themeColor={state === 'failed' ? 'destructive' : 'textSecondary'}
          >
            {pending ? 'Saving…' : 'Could not save. Tap to retry.'}
          </ThemedText>
        ) : null}
        {highlighted && !done ? (
          <View style={styles.highlightBadge}>
            <SymbolView
              name={platformSymbol('scope')}
              size={12}
              tintColor="#A86400"
            />
            <ThemedText type="smallBold" style={styles.highlightLabel}>
              HIGHLIGHT
            </ThemedText>
          </View>
        ) : null}
        {task.dueDate !== null && !done ? (
          <ThemedText
            type="small"
            themeColor={overdue ? 'destructive' : 'textSecondary'}
          >
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDueDate(task.dueDate)}
          </ThemedText>
        ) : null}
      </View>
      {onAddSubtask && !done ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add subtask to ${task.title}`}
          onPress={(event) => {
            event.stopPropagation();
            onAddSubtask();
          }}
          style={({ pressed }) => [
            styles.addSubtask,
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={platformSymbol('plus.circle')}
            size={18}
            tintColor={theme.textSecondary}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addSubtask: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  subtaskRow: {
    paddingLeft: Spacing.five,
    paddingVertical: Spacing.one,
  },
  body: {
    flex: 1,
    gap: Spacing.half,
  },
  highlightBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: '#FFF1D9',
  },
  highlightLabel: {
    color: '#A86400',
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.7,
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    textDecorationLine: 'line-through',
  },
  pressed: {
    opacity: 0.7,
  },
});
