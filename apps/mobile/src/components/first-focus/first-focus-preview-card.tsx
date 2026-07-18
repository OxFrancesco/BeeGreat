import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation } from 'convex/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { GolieBee } from '@/components/first-focus/golie-bee';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearPendingFirstFocus, registerPendingFirstFocus } from '@/lib/first-focus-confirmation';
import { endOfLocalDay, type FirstFocusPreview, formatHighlightExpiry } from '@/lib/first-focus';
import { useScreenshotFixture } from '@/lib/screenshot-fixture';

type PreviewStatus = 'editing' | 'saving' | 'saved' | 'cancelling' | 'cancelled';
type ConfirmPlan = (
  args: FunctionArgs<typeof api.firstFocus.confirmPlan>,
) => Promise<FunctionReturnType<typeof api.firstFocus.confirmPlan>>;

export function FirstFocusPreviewCard({ preview }: { preview: FirstFocusPreview }) {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return (
      <FirstFocusPreviewCardView
        preview={preview}
        confirmPlan={fixture.confirmFirstFocus}
      />
    );
  }

  return <LiveFirstFocusPreviewCard preview={preview} />;
}

function LiveFirstFocusPreviewCard({ preview }: { preview: FirstFocusPreview }) {
  const confirmPlan = useMutation(api.firstFocus.confirmPlan);
  return (
    <FirstFocusPreviewCardView preview={preview} confirmPlan={confirmPlan} />
  );
}

export function FirstFocusPreviewCardView({
  preview,
  confirmPlan,
}: {
  preview: FirstFocusPreview;
  confirmPlan: ConfirmPlan;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [goalTitle, setGoalTitle] = useState(preview.goalTitle);
  const [projectTitle, setProjectTitle] = useState(preview.projectTitle);
  const [taskTitle, setTaskTitle] = useState(preview.taskTitle);
  const [highlightExpiresAt, setHighlightExpiresAt] = useState(
    preview.highlightExpiresAt ?? endOfLocalDay(),
  );
  const [status, setStatus] = useState<PreviewStatus>('editing');
  const [error, setError] = useState<string | null>(null);

  const valid = Boolean(goalTitle.trim() && projectTitle.trim() && taskTitle.trim());
  const busy = status === 'saving' || status === 'cancelling';

  const save = useCallback(async () => {
    if (!valid || busy) return false;
    setStatus('saving');
    setError(null);
    try {
      await confirmPlan({
        requestId: preview.requestId,
        confirmed: true,
        goalTitle: goalTitle.trim(),
        projectTitle: projectTitle.trim(),
        taskTitle: taskTitle.trim(),
        highlightExpiresAt,
      });
      clearPendingFirstFocus(preview.requestId);
      setStatus('saved');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (cause) {
      setStatus('editing');
      setError(cause instanceof Error ? cause.message : 'The plan could not be saved.');
      return false;
    }
  }, [
    busy,
    confirmPlan,
    goalTitle,
    highlightExpiresAt,
    preview.requestId,
    projectTitle,
    taskTitle,
    valid,
  ]);

  useEffect(() => {
    if (status !== 'editing') return;
    return registerPendingFirstFocus(preview.requestId, save);
  }, [preview.requestId, save, status]);

  const cancel = async () => {
    if (busy) return;
    setStatus('cancelling');
    setError(null);
    try {
      await confirmPlan({
        requestId: preview.requestId,
        confirmed: false,
        goalTitle: goalTitle.trim() || preview.goalTitle,
        projectTitle: projectTitle.trim() || preview.projectTitle,
        taskTitle: taskTitle.trim() || preview.taskTitle,
        highlightExpiresAt,
      });
      clearPendingFirstFocus(preview.requestId);
      setStatus('cancelled');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (cause) {
      setStatus('editing');
      setError(cause instanceof Error ? cause.message : 'The preview could not be cancelled.');
    }
  };

  if (status === 'saved') {
    return (
      <Animated.View
        entering={reducedMotion ? undefined : FadeIn.duration(220)}
        style={[styles.card, styles.resultCard, { backgroundColor: theme.secondary }]}
      >
        <View style={styles.resultHeading}>
          <SymbolView name="checkmark.seal.fill" size={24} tintColor={theme.secondaryForeground} />
          <View style={styles.flex}>
            <ThemedText type="smallBold" themeColor="secondaryForeground" selectable>
              Your first focus is live
            </ThemedText>
            <ThemedText type="small" themeColor="secondaryForeground" selectable>
              The Goal, Project, Task, and Highlight were created together.
            </ThemedText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your Hive"
          onPress={() => router.navigate('/hive')}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
            Meet your GolieBee
          </ThemedText>
        </Pressable>
      </Animated.View>
    );
  }

  if (status === 'cancelled') {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText type="smallBold" selectable>
          Preview cancelled
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" selectable>
          Nothing was created. Tell Bee when you are ready to try again.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <GolieBee seed={preview.seed ?? preview.requestId} compact />
        <View style={styles.flex}>
          <ThemedText type="smallBold" selectable>
            Your first focus
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            Review everything before Bee creates it.
          </ThemedText>
        </View>
      </View>

      <View style={styles.fields}>
        <EditableField
          label="GOAL"
          accessibilityLabel="Goal title"
          value={goalTitle}
          onChangeText={setGoalTitle}
          editable={!busy}
        />
        <EditableField
          label="PROJECT"
          accessibilityLabel="Project title"
          value={projectTitle}
          onChangeText={setProjectTitle}
          editable={!busy}
        />
        <EditableField
          label="FIRST TASK · HIGHLIGHT"
          accessibilityLabel="First highlighted task title"
          value={taskTitle}
          onChangeText={setTaskTitle}
          editable={!busy}
        />
      </View>

      <View style={styles.expirySection}>
        <View style={styles.expiryCopy}>
          <ThemedText type="smallBold" selectable>
            Highlight until
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            {formatHighlightExpiry(highlightExpiresAt)}
          </ThemedText>
        </View>
        <View accessibilityRole="radiogroup" style={styles.expiryOptions}>
          <ExpiryOption
            label="Today"
            selected={isSameLocalDay(highlightExpiresAt, endOfLocalDay())}
            disabled={busy}
            onPress={() => setHighlightExpiresAt(endOfLocalDay())}
          />
          <ExpiryOption
            label="Tomorrow"
            selected={isSameLocalDay(highlightExpiresAt, endOfLocalDay(1))}
            disabled={busy}
            onPress={() => setHighlightExpiresAt(endOfLocalDay(1))}
          />
        </View>
      </View>

      {error ? (
        <ThemedText accessibilityRole="alert" type="small" themeColor="destructive" selectable>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel first focus preview"
          disabled={busy}
          onPress={cancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold">
            {status === 'cancelling' ? 'Cancelling…' : 'Cancel'}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm and create first focus"
          accessibilityHint="Creates the Goal, Project, Task, and Highlight together"
          accessibilityState={{
            disabled: !valid || busy,
            busy: status === 'saving',
          }}
          disabled={!valid || busy}
          onPress={save}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: theme.primary },
            (!valid || busy) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
            {status === 'saving' ? 'Creating…' : 'Create my focus'}
          </ThemedText>
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.voiceHint} selectable>
        You can also say or type “Yes”.
      </ThemedText>
    </View>
  );
}

function EditableField({
  label,
  accessibilityLabel,
  value,
  onChangeText,
  editable,
}: {
  label: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        returnKeyType="next"
        selectTextOnFocus
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            fontFamily: Fonts.sans,
          },
        ]}
      />
    </View>
  );
}

function ExpiryOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`Highlight expires ${label.toLowerCase()}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.expiryOption,
        { borderColor: selected ? theme.primary : theme.border },
        selected && { backgroundColor: theme.secondary },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText type="smallBold" themeColor={selected ? 'secondaryForeground' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function isSameLocalDay(left: number, right: number) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  resultCard: {
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  resultHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  fields: {
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  expirySection: {
    gap: Spacing.two,
  },
  expiryCopy: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  expiryOptions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  expiryOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    flex: 1.5,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.68,
  },
  voiceHint: {
    textAlign: 'center',
  },
});
