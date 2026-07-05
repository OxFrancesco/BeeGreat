import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  return (
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
  );
}

const styles = StyleSheet.create({
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
