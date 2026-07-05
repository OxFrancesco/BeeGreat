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
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const canSend = Boolean(text.trim()) && !disabled;

  const submit = () => {
    const message = text.trim();
    if (!message) return;
    setText('');
    onSubmit(message);
  };

  const typed = text.trim().toLowerCase();
  const matchingCommands = typed.startsWith('/')
    ? COMMANDS.filter((item) => item.command.startsWith(typed))
    : [];

  const runCommand = (command: string) => {
    setText('');
    onSubmit(command);
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
          onSubmitEditing={submit}
          placeholder="Ask Bee anything…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, fontFamily: Fonts.sans }]}
          editable={!disabled}
          returnKeyType="send"
          submitBehavior="submit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={submit}
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
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: Spacing.one,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
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
