import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small inline input used to add goals, projects, and tasks in place,
 * matching the prompt-input bar styling.
 */
export function InlineComposer({
  placeholder,
  onSubmit,
  autoFocus,
  compact,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    onSubmit(value);
  };

  return (
    <View
      style={[
        styles.bar,
        compact && styles.compact,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          compact && styles.inputCompact,
          { color: theme.text, fontFamily: Fonts.sans },
        ]}
        autoFocus={autoFocus}
        returnKeyType="done"
        submitBehavior="submit"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={submit}
        disabled={!text.trim()}
        style={[
          styles.action,
          compact && styles.actionCompact,
          { backgroundColor: text.trim() ? theme.primary : theme.backgroundSelected },
        ]}
      >
        <SymbolView
          name="plus"
          size={compact ? 14 : 16}
          tintColor={text.trim() ? theme.primaryForeground : theme.textSecondary}
          fallback={
            <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
              Add
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
  compact: {
    paddingVertical: Spacing.half,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  inputCompact: {
    fontSize: 14,
    paddingVertical: Spacing.one,
  },
  action: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
