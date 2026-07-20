import { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';

type Execution = FunctionReturnType<typeof api.nfcActions.execute>;

export function NfcActionExecutionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ publicId?: string | string[] }>();
  const publicId = Array.isArray(params.publicId) ? params.publicId[0] : params.publicId;
  const validPublicId = typeof publicId === 'string' && /^[a-f0-9]{32}$/.test(publicId);
  const { localDate, timeZone } = useCurrentLocalDay();
  const execute = useMutation(api.nfcActions.execute);
  const undo = useMutation(api.nfcActions.undo);
  const started = useRef(false);
  const [result, setResult] = useState<Execution | null>(null);
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

  const amount = result?.outcome.type === 'hydration' ? result.outcome.appliedMl : 0;
  const configuredAmount =
    result?.action.definition.type === 'hydration' ? result.action.definition.amountMl : 0;

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
          ) : status === 'error' ? (
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
          ) : status === 'undone' ? (
            <>
              <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                <SymbolView
                  name="arrow.uturn.backward"
                  size={28}
                  tintColor={theme.primary}
                  fallback={<ThemedText>↶</ThemedText>}
                />
              </View>
              <ThemedText style={styles.title}>Water entry undone</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                Removed {amount || configuredAmount} ml from today’s water.
              </ThemedText>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: '#DDF3FA' }]}>
                <SymbolView
                  name="drop.fill"
                  size={30}
                  tintColor="#2F8795"
                  fallback={<ThemedText style={{ color: '#2F8795' }}>●</ThemedText>}
                />
              </View>
              <ThemedText style={styles.title}>
                {result?.duplicate ? 'Already logged' : `Added ${amount} ml`}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.body}>
                {result?.duplicate
                  ? `The repeated tap was ignored. ${result.action.label} already ran.`
                  : `${result?.action.label ?? 'Your NFC action'} updated today’s water.`}
              </ThemedText>
            </>
          )}

          {status !== 'running' ? (
            <View style={styles.actions}>
              {status === 'success' && result && !result.duplicate && amount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: undoing }}
                  disabled={undoing}
                  onPress={() => {
                    setUndoing(true);
                    void undo({ executionId: result.executionId })
                      .then(() => setStatus('undone'))
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
                onPress={() => router.replace('/bee-healthy/water')}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                  View Water
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
