import { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';

import { completionCopy } from './reminder-actions-screen';

type Execution = FunctionReturnType<typeof api.nfcActions.execute>;
type UndoResult = FunctionReturnType<typeof api.nfcActions.undo>;
type ActionType = Execution['action']['definition']['type'];
type Theme = ReturnType<typeof useTheme>;

function appliedMl(result: Execution) {
  return result.outcome.type === 'hydration' ? result.outcome.appliedMl : 0;
}

function undoneMl(undone: UndoResult) {
  const removed =
    undone.outcome.type === 'hydration' ? Math.abs(undone.outcome.appliedMl) : 0;
  const configured =
    undone.action.definition.type === 'hydration' ? undone.action.definition.amountMl : 0;
  return removed || configured;
}

/** Per-action-type copy and styling; everything else in this screen is the
 * shared run → success/duplicate → undo flow. */
const PRESENTATIONS = {
  hydration: {
    symbol: 'drop.fill',
    glyph: '●',
    colors: () => ({ background: '#DDF3FA', foreground: '#2F8795' }),
    route: '/bee-healthy/water',
    cta: 'View Water',
    duplicateTitle: 'Already logged',
    successTitle: (result) => `Added ${appliedMl(result)} ml`,
    successBody: (result) => `${result.action.label} updated today’s water.`,
    undoneTitle: 'Water entry undone',
    undoneBody: (undone) => `Removed ${undoneMl(undone)} ml from today’s water.`,
  },
  reminder: {
    symbol: 'checkmark.circle.fill',
    glyph: '✓',
    colors: (theme) => ({
      background: theme.secondary,
      foreground: theme.secondaryForeground,
    }),
    route: '/goals/reminders',
    cta: 'View Reminders',
    duplicateTitle: 'Already counted',
    successTitle: (result) => `${result.action.label} counted`,
    successBody: (result) => `Completion ${result.action.completionCount} is saved.`,
    undoneTitle: 'Reminder count undone',
    undoneBody: (undone) =>
      `${undone.action.label} is back to ${completionCopy(undone.action.completionCount)}.`,
  },
} satisfies Record<
  ActionType,
  {
    symbol: SymbolViewProps['name'];
    glyph: string;
    colors: (theme: Theme) => { background: string; foreground: string };
    route: Href;
    cta: string;
    duplicateTitle: string;
    successTitle: (result: Execution) => string;
    successBody: (result: Execution) => string;
    undoneTitle: string;
    undoneBody: (undone: UndoResult) => string;
  }
>;

export function NfcActionExecutionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ publicId?: string | string[] }>();
  const publicId = Array.isArray(params.publicId) ? params.publicId[0] : params.publicId;
  const validPublicId = publicId !== undefined && /^[a-f0-9]{32}$/.test(publicId);
  const { localDate, timeZone } = useCurrentLocalDay();
  const execute = useMutation(api.nfcActions.execute);
  const undo = useMutation(api.nfcActions.undo);
  const started = useRef(false);
  const [result, setResult] = useState<Execution | null>(null);
  const [undone, setUndone] = useState<UndoResult | null>(null);
  const [status, setStatus] = useState<'running' | 'success' | 'undone' | 'error'>(
    validPublicId ? 'running' : 'error',
  );
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (started.current || !validPublicId || !publicId) return;
    started.current = true;
    void execute({ publicId, localDate, timeZone })
      .then((execution) => {
        setResult(execution);
        setStatus('success');
        if (process.env.EXPO_OS === 'ios' && !execution.duplicate) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      })
      .catch(() => setStatus('error'));
  }, [execute, localDate, publicId, timeZone, validPublicId]);

  const presentation = result ? PRESENTATIONS[result.action.definition.type] : undefined;
  const iconColors = presentation?.colors(theme);
  const canUndo =
    status === 'success' &&
    result !== null &&
    !result.duplicate &&
    (result.outcome.type === 'hydration'
      ? result.outcome.appliedMl > 0
      : result.outcome.appliedCount > 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, { maxWidth: MaxContentWidth }]}>
          {status === 'running' ? (
            <>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={styles.title}>Running tap action…</ThemedText>
            </>
          ) : status === 'error' || !result || !presentation ? (
            <>
              <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name="exclamationmark"
                  size={28}
                  tintColor={theme.destructive}
                  fallback={<ThemedText themeColor="destructive">!</ThemedText>}
                />
              </View>
              <ThemedText style={styles.title}>Tap action unavailable</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                It may be disabled, deleted, or registered to another BeeGreat account.
              </ThemedText>
            </>
          ) : status === 'undone' && undone ? (
            <>
              <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name="arrow.uturn.backward"
                  size={28}
                  tintColor={theme.primary}
                  fallback={<ThemedText>↶</ThemedText>}
                />
              </View>
              <ThemedText style={styles.title}>{presentation.undoneTitle}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                {presentation.undoneBody(undone)}
              </ThemedText>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: iconColors?.background }]}>
                <SymbolView
                  name={presentation.symbol}
                  size={30}
                  tintColor={iconColors?.foreground}
                  fallback={
                    <ThemedText style={{ color: iconColors?.foreground }}>
                      {presentation.glyph}
                    </ThemedText>
                  }
                />
              </View>
              <ThemedText style={styles.title}>
                {result.duplicate
                  ? presentation.duplicateTitle
                  : presentation.successTitle(result)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                {result.duplicate
                  ? `The repeated tap was ignored. ${result.action.label} already ran.`
                  : presentation.successBody(result)}
              </ThemedText>
            </>
          )}

          {status !== 'running' ? (
            <View style={styles.actions}>
              {canUndo && result ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: undoing }}
                  disabled={undoing}
                  onPress={() => {
                    setUndoing(true);
                    void undo({ executionId: result.executionId })
                      .then((undoResult) => {
                        setUndone(undoResult);
                        setStatus('undone');
                      })
                      .catch(() => setStatus('error'))
                      .finally(() => setUndoing(false));
                  }}
                  style={({ pressed }) => [
                    styles.quietButton,
                    { borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  {undoing ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <ThemedText type="smallBold">Undo</ThemedText>
                  )}
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace(presentation?.route ?? '/goals')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                  {presentation?.cta ?? 'Open Goals'}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  body: { textAlign: 'center' },
  actions: { width: '100%', gap: Spacing.two, paddingTop: Spacing.two },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  quietButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.72 },
});
