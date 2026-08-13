import { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/goals/screen-header';
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

export type NfcAction = FunctionReturnType<typeof api.nfcActions.list>[number];
export type NfcActionDefinition = NfcAction['definition'];

type Theme = ReturnType<typeof useTheme>;

/** Everything that differs between NFC action types lives here; the screen
 * and card below own all shared behaviour (write, create, edit, delete). */
export type NfcActionTypeConfig = {
  type: NfcActionDefinition['type'];
  /** Noun used in user-facing copy, e.g. 'tap action' or 'reminder'. */
  noun: string;
  /** When set, the screen renders its own safe area, back header, and
   * keyboard avoidance (for routes pushed without a native header). */
  header?: { title: string };
  intro: {
    title: string;
    body: string;
    meta?: (actions: NfcAction[]) => string | null;
  };
  listTitle: string;
  createTitle: string;
  defaultLabel: string;
  labelPlaceholder: string;
  labelFieldName: string;
  editorHint: string;
  icon: {
    symbol: SymbolViewProps['name'];
    glyph: string;
    colors: (theme: Theme) => { background: string; foreground: string };
  };
  subtitle: (action: NfcAction) => string;
  defaultDefinition: NfcActionDefinition;
  DefinitionField?: (props: {
    value: NfcActionDefinition;
    onChange: (definition: NfcActionDefinition) => void;
    context: 'create' | 'edit';
  }) => ReactNode;
};

function NfcActionCard({
  config,
  action,
  writing,
  onWrite,
  onUpdate,
  onRemove,
}: {
  config: NfcActionTypeConfig;
  action: NfcAction;
  writing: boolean;
  onWrite: () => void;
  onUpdate: (patch: {
    label?: string;
    enabled?: boolean;
    definition?: NfcActionDefinition;
  }) => Promise<void>;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(action.label);
  const [definition, setDefinition] = useState(action.definition);
  const [saving, setSaving] = useState(false);
  const iconColors = config.icon.colors(theme);
  const canSave = label.trim().length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({ label, definition });
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
        <View style={[styles.icon, { backgroundColor: iconColors.background }]}>
          <SymbolView
            name={config.icon.symbol}
            size={18}
            tintColor={iconColors.foreground}
            fallback={
              <ThemedText style={{ color: iconColors.foreground }}>
                {config.icon.glyph}
              </ThemedText>
            }
          />
        </View>
        <View style={styles.actionCopy}>
          <ThemedText type="default" style={styles.actionTitle} numberOfLines={1}>
            {action.label}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable style={styles.subtitle}>
            {config.subtitle(action)}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel={`${action.label} NFC ${config.noun}`}
          value={action.enabled}
          onValueChange={(enabled) => void onUpdate({ enabled }).catch(() => undefined)}
          trackColor={{ true: theme.primary }}
        />
      </View>

      {editing ? (
        <View style={styles.editor}>
          <TextInput
            accessibilityLabel={config.labelFieldName}
            value={label}
            maxLength={60}
            onChangeText={setLabel}
            placeholder={config.labelPlaceholder}
            placeholderTextColor={theme.textSecondary}
            selectionColor="#D89B21"
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
            ]}
          />
          {config.DefinitionField ? (
            <config.DefinitionField value={definition} onChange={setDefinition} context="edit" />
          ) : null}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLabel(action.label);
                setDefinition(action.definition);
                setEditing(false);
              }}
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
              accessibilityState={{ busy: saving, disabled: !canSave }}
              disabled={saving || !canSave}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: canSave ? theme.primary : theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText
                  type="smallBold"
                  style={{ color: canSave ? theme.primaryForeground : theme.textSecondary }}
                >
                  Save changes
                </ThemedText>
              )}
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {config.editorHint}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: writing }}
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

export function NfcActionTypeScreen({ config }: { config: NfcActionTypeConfig }) {
  const theme = useTheme();
  const allActions = useQuery(api.nfcActions.list);
  const createAction = useMutation(api.nfcActions.create);
  const updateAction = useMutation(api.nfcActions.update);
  const removeAction = useMutation(api.nfcActions.remove);
  const [label, setLabel] = useState(config.defaultLabel);
  const [definition, setDefinition] = useState(config.defaultDefinition);
  const [creating, setCreating] = useState(false);
  const [writingId, setWritingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = allActions?.filter((action) => action.definition.type === config.type);
  const introMeta = actions ? (config.intro.meta?.(actions) ?? null) : null;
  const canCreate = label.trim().length > 0;

  const writeTag = async (action: Pick<NfcAction, '_id' | 'label' | 'tagUrl'>) => {
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
      const action = await createAction({ label, definition });
      await writeTag(action);
      setLabel(config.defaultLabel);
      setDefinition(config.defaultDefinition);
    } catch (cause) {
      setError(nfcErrorMessage(cause));
    } finally {
      setCreating(false);
    }
  };

  const body = (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.scrollContent,
        config.header ? styles.scrollContentHeader : styles.scrollContentPlain,
      ]}
    >
      <View style={styles.content}>
        {config.header ? <ScreenHeader title={config.header.title} showBack /> : null}
        <View style={styles.intro}>
          <ThemedText type="default" style={styles.introTitle}>
            {config.intro.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {config.intro.body}
          </ThemedText>
          {introMeta ? (
            <ThemedText type="small" themeColor="textSecondary" selectable>
              {introMeta}
            </ThemedText>
          ) : null}
        </View>

        {actions === undefined ? (
          <ActivityIndicator color={theme.primary} style={styles.loading} />
        ) : actions.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {config.listTitle}
            </ThemedText>
            {actions.map((action) => (
              <NfcActionCard
                key={action._id}
                config={config}
                action={action}
                writing={writingId === action._id}
                onWrite={() => void writeTag(action)}
                onUpdate={async (patch) => {
                  setError(null);
                  try {
                    await updateAction({ actionId: action._id, ...patch });
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : `Could not update the ${config.noun}.`,
                    );
                    throw cause;
                  }
                }}
                onRemove={() =>
                  Alert.alert(
                    `Delete ${config.noun}?`,
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
                                : `Could not delete the ${config.noun}.`,
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
          <ThemedText type="smallBold" themeColor="textSecondary">
            {config.createTitle}
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              accessibilityLabel={config.labelFieldName}
              value={label}
              maxLength={60}
              onChangeText={setLabel}
              placeholder={config.labelPlaceholder}
              placeholderTextColor={theme.textSecondary}
              selectionColor="#D89B21"
              returnKeyType="done"
              onSubmitEditing={() => void createAndWrite()}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
              ]}
            />
            {config.DefinitionField ? (
              <config.DefinitionField
                value={definition}
                onChange={setDefinition}
                context="create"
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: creating, disabled: !canCreate }}
              disabled={creating || !canCreate}
              onPress={() => void createAndWrite()}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: canCreate ? theme.primary : theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              {creating ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <ThemedText
                  type="smallBold"
                  style={{ color: canCreate ? theme.primaryForeground : theme.textSecondary }}
                >
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
          <ThemedText
            type="small"
            themeColor="destructive"
            accessibilityLiveRegion="assertive"
            selectable
          >
            {error}
          </ThemedText>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <ThemedView style={[styles.container, config.header && styles.containerCentered]}>
      {config.header ? (
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          >
            {body}
          </KeyboardAvoidingView>
        </SafeAreaView>
      ) : (
        body
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  containerCentered: { alignItems: 'center' },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
  },
  flex: { flex: 1 },
  scrollContent: { alignItems: 'center' },
  scrollContentPlain: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  scrollContentHeader: { paddingBottom: Spacing.five },
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
  subtitle: { fontVariant: ['tabular-nums'] },
  editor: { gap: Spacing.three },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '500',
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
  feedback: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 14,
    padding: Spacing.three,
  },
  loading: { paddingVertical: Spacing.five },
  pressed: { opacity: 0.72 },
});
