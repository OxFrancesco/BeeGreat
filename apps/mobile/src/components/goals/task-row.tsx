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
  return new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** One row of the project to-do list; subtasks render indented and smaller. */
export function TaskRow({
  task,
  isSubtask,
  onToggle,
  onLongPress,
  onAddSubtask,
}: {
  task: TaskItem;
  isSubtask?: boolean;
  onToggle: () => void;
  onLongPress: () => void;
  onAddSubtask?: () => void;
}) {
  const theme = useTheme();
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
      { scale: reducedMotion ? 1 : MotionScale.pressed + 0.03 * (1 - iconProgress.value) },
    ],
  }));
  const doneIconStyle = useAnimatedStyle(() => ({
    opacity: iconProgress.value,
    transform: [
      { scale: reducedMotion ? 1 : MotionScale.pressed + 0.03 * iconProgress.value },
    ],
  }));

  const toggle = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${done ? 'Reopen' : 'Complete'} task ${task.title}`}
      onPress={toggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, isSubtask && styles.subtaskRow, pressed && styles.pressed]}
    >
      <View
        accessibilityElementsHidden
        pointerEvents="none"
        style={{ width: isSubtask ? 18 : 22, height: isSubtask ? 18 : 22 }}
      >
        <Animated.View style={[styles.iconLayer, todoIconStyle]}>
          <SymbolView
            name="circle"
            size={isSubtask ? 18 : 22}
            tintColor={theme.textSecondary}
            fallback={
              <ThemedText type="smallBold" themeColor="textSecondary">
                ☐
              </ThemedText>
            }
          />
        </Animated.View>
        <Animated.View style={[styles.iconLayer, doneIconStyle]}>
          <SymbolView
            name="checkmark.circle.fill"
            size={isSubtask ? 18 : 22}
            tintColor={Honey}
            fallback={<ThemedText type="smallBold">☑</ThemedText>}
          />
        </Animated.View>
      </View>
      <View style={styles.body}>
        <ThemedText
          type={isSubtask ? 'small' : 'default'}
          themeColor={done ? 'textSecondary' : 'text'}
          style={done && styles.done}
          numberOfLines={2}
        >
          {task.title}
        </ThemedText>
        {task.dueDate !== null && !done ? (
          <ThemedText type="small" themeColor={overdue ? 'destructive' : 'textSecondary'}>
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDueDate(task.dueDate)}
          </ThemedText>
        ) : null}
      </View>
      {onAddSubtask && !done ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add subtask to ${task.title}`}
          hitSlop={Spacing.two}
          onPress={onAddSubtask}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <SymbolView
            name="plus.circle"
            size={18}
            tintColor={theme.textSecondary}
            fallback={<ThemedText type="smallBold" themeColor="textSecondary">+</ThemedText>}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
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
