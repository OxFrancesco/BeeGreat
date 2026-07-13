import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Slash commands the input recognizes; typing `/` lists them. */
const COMMANDS = [
  { command: '/clear', description: 'Clear the conversation and start fresh' },
  { command: '/new', description: 'Start a new conversation' },
] as const;

/**
 * Text fallback for the voice agent, ported from the ai-elements PromptInput
 * idea: voice stays primary (via the Talk tab button), typing always works
 * (noisy rooms, accessibility).
 */
export function PromptInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSend = Boolean(text.trim()) && !disabled && !submitting;

  const submit = async () => {
    const message = text.trim();
    if (!message || disabled || submitting) return;
    setText('');
    setSubmitting(true);
    try {
      await onSubmit(message);
    } catch {
      // A failed send must never eat the user's draft. Preserve anything they
      // typed while the request was in flight, otherwise restore the message.
      setText((current) => current || message);
    } finally {
      setSubmitting(false);
    }
  };

  const typed = text.trim().toLowerCase();
  const matchingCommands = typed.startsWith('/')
    ? COMMANDS.filter((item) => item.command.startsWith(typed))
    : [];

  const runCommand = async (command: string) => {
    setText('');
    setSubmitting(true);
    try {
      await onSubmit(command);
    } catch {
      setText(command);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      {matchingCommands.length > 0 ? (
        <View style={[styles.commands, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {matchingCommands.map((item) => (
            <Pressable
              key={item.command}
              accessibilityRole="button"
              accessibilityLabel={`${item.command}: ${item.description}`}
              onPress={() => runCommand(item.command)}
              style={({ pressed }) => [
                styles.commandRow,
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText type="smallBold">{item.command}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.commandHint}>
                {item.description}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void submit()}
          placeholder="Ask Bee anything…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, fontFamily: Fonts.sans }]}
          accessibilityLabel="Message Bee"
          editable
          multiline
          maxLength={4000}
          returnKeyType="send"
          submitBehavior="submit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={() => void submit()}
          disabled={!canSend}
          style={[
            styles.action,
            { backgroundColor: theme.primary },
            !canSend && styles.actionDisabled,
          ]}
        >
          <SymbolView
            name="arrow.up"
            size={16}
            tintColor={theme.primaryForeground}
            fallback={
              <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
                Send
              </ThemedText>
            }
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commands: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
    paddingVertical: Spacing.one,
    overflow: 'hidden',
  },
  commandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  commandHint: {
    flexShrink: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
    borderCurve: 'continuous',
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 36,
    maxHeight: 108,
    paddingTop: 7,
    paddingBottom: 7,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.4,
  },
});
