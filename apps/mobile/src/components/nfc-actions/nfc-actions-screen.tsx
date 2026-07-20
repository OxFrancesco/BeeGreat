import { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  NfcUnavailableError,
  isNfcAvailable,
  nfcErrorMessage,
  writeNfcActionTag,
} from '@/lib/nfc-tags';

const WATER_AMOUNTS = [250, 330, 500, 750] as const;
type NfcAction = FunctionReturnType<typeof api.nfcActions.list>[number];

function AmountPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (amount: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.amounts} accessibilityRole="radiogroup">
      {WATER_AMOUNTS.map((amount) => {
        const selected = value === amount;
        return (
          <Pressable
            key={amount}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(amount);
            }}
            style={({ pressed }) => [
              styles.amount,
              {
                backgroundColor: selected ? theme.secondary : theme.backgroundElement,
                borderColor: selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              type="smallBold"
              style={selected ? { color: theme.secondaryForeground } : undefined}
            >
              {amount} ml
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionCard({
  action,
  writing,
  onWrite,
  onUpdate,
  onRemove,
}: {
  action: NfcAction;
  writing: boolean;
  onWrite: () => void;
  onUpdate: (patch: {
    label?: string;
    enabled?: boolean;
    definition?: { type: 'hydration'; amountMl: number };
  }) => Promise<void>;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(action.label);
  const [amount, setAmount] = useState(
    action.definition.type === 'hydration' ? action.definition.amountMl : 250,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({
        label,
        definition: { type: 'hydration', amountMl: amount },
      });
      setEditing(false);
    } catch {
      // The screen-level live region owns the error message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.actionHeading}>
        <View style={[styles.icon, { backgroundColor: '#DDF3FA' }]}>
          <SymbolView
            name="drop.fill"
            size={18}
            tintColor="#2F8795"
            fallback={<ThemedText style={{ color: '#2F8795' }}>●</ThemedText>}
          />
        </View>
        <View style={styles.actionCopy}>
          <ThemedText type="default" style={styles.actionTitle} numberOfLines={1}>
            {action.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add {action.definition.amountMl} ml of water
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel={`${action.label} NFC action`}
          value={action.enabled}
          onValueChange={(enabled) => void onUpdate({ enabled }).catch(() => undefined)}
          trackColor={{ true: theme.primary }}
        />
      </View>

      {editing ? (
        <View style={styles.editor}>
          <TextInput
            accessibilityLabel="NFC action name"
            value={label}
            maxLength={60}
            onChangeText={setLabel}
            placeholder="Bottle name"
            placeholderTextColor={theme.textSecondary}
            selectionColor="#D89B21"
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
            ]}
          />
          <AmountPicker value={amount} onChange={setAmount} />
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setEditing(false)}
              style={({ pressed }) => [
                styles.quietButton,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Cancel</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || label.trim().length === 0}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                  Save changes
                </ThemedText>
              )}
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            The same NFC tag will use the new amount—no rewrite needed.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            disabled={writing}
            onPress={onWrite}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            {writing ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                Write NFC tag
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing(true)}
            style={({ pressed }) => [
              styles.quietButton,
              { borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold">Edit</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${action.label}`}
            hitSlop={Spacing.two}
            onPress={onRemove}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <SymbolView
              name="trash"
              size={17}
              tintColor={theme.destructive}
              fallback={<ThemedText themeColor="destructive">Delete</ThemedText>}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function NfcActionsScreen() {
  const theme = useTheme();
  const actions = useQuery(api.nfcActions.list);
  const createAction = useMutation(api.nfcActions.create);
  const updateAction = useMutation(api.nfcActions.update);
  const removeAction = useMutation(api.nfcActions.remove);
  const [label, setLabel] = useState('Water bottle');
  const [amount, setAmount] = useState(250);
  const [creating, setCreating] = useState(false);
  const [writingId, setWritingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const writeTag = async (action: NfcAction) => {
    setWritingId(action._id);
    setError(null);
    setMessage(null);
    try {
      await writeNfcActionTag(action.tagUrl);
      if (process.env.EXPO_OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setMessage(`${action.label} is ready to tap.`);
    } catch (cause) {
      setError(nfcErrorMessage(cause));
    } finally {
      setWritingId(null);
    }
  };

  const createAndWrite = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      if (!(await isNfcAvailable())) {
        throw new NfcUnavailableError(
          'NFC needs a physical phone with a fresh BeeGreat development or production build.',
        );
      }
      const action = await createAction({
        label,
        definition: { type: 'hydration', amountMl: amount },
      });
      await writeTag(action);
      setLabel('Water bottle');
      setAmount(250);
    } catch (cause) {
      setError(nfcErrorMessage(cause));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.intro}>
            <ThemedText type="default" style={styles.introTitle}>
              One tag, one useful action
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              The tag stores a private BeeGreat link. Its action stays here, so you can
              change the amount later without touching the tag again.
            </ThemedText>
          </View>

          {actions === undefined ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : actions.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Your tap actions</ThemedText>
              {actions.map((action) => (
                <ActionCard
                  key={action._id}
                  action={action}
                  writing={writingId === action._id}
                  onWrite={() => void writeTag(action)}
                  onUpdate={async (patch) => {
                    setError(null);
                    try {
                      await updateAction({ actionId: action._id, ...patch });
                    } catch (cause) {
                      setError(cause instanceof Error ? cause.message : 'Could not update the action.');
                      throw cause;
                    }
                  }}
                  onRemove={() =>
                    Alert.alert(
                      'Delete tap action?',
                      `${action.label} will stop working immediately. The NFC tag itself will not be erased.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            setError(null);
                            void removeAction({ actionId: action._id }).catch((cause) => {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : 'Could not delete the action.',
                              );
                            });
                          },
                        },
                      ],
                    )
                  }
                />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="smallBold">New water action</ThemedText>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TextInput
                accessibilityLabel="NFC action name"
                value={label}
                maxLength={60}
                onChangeText={setLabel}
                placeholder="Water bottle"
                placeholderTextColor={theme.textSecondary}
                selectionColor="#D89B21"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
                ]}
              />
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  Amount per tap
                </ThemedText>
                <AmountPicker value={amount} onChange={setAmount} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: creating, disabled: label.trim().length === 0 }}
                disabled={creating || label.trim().length === 0}
                onPress={() => void createAndWrite()}
                style={({ pressed }) => [
                  styles.createButton,
                  {
                    backgroundColor:
                      label.trim().length === 0 ? theme.backgroundElement : theme.primary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                {creating ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                    Create and write tag
                  </ThemedText>
                )}
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary">
                Use a writable NDEF tag such as NTAG213, NTAG215, or NTAG216.
              </ThemedText>
            </View>
          </View>

          {message ? (
            <View style={[styles.feedback, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" accessibilityLiveRegion="polite">
                {message}
              </ThemedText>
            </View>
          ) : null}
          {error ? (
            <ThemedText type="small" themeColor="destructive" accessibilityLiveRegion="assertive">
              {error}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.four },
  intro: { gap: Spacing.one },
  introTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  section: { gap: Spacing.two },
  card: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  actionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: Spacing.half },
  actionTitle: { fontWeight: '700' },
  editor: { gap: Spacing.three },
  field: { gap: Spacing.two },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '500',
  },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  amount: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  quietButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  feedback: { minHeight: 44, justifyContent: 'center', borderRadius: 14, padding: Spacing.three },
  loading: { paddingVertical: Spacing.five },
  pressed: { opacity: 0.72 },
});
