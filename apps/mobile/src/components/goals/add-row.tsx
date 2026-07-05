import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Minimal add flow: a plus row that turns into a text input when tapped.
 * Return creates, tapping away dismisses.
 */
export function AddRow({
  label,
  onSubmit,
  dashed,
  compact,
  startActive,
  onDismiss,
}: {
  label: string;
  onSubmit: (title: string) => void;
  dashed?: boolean;
  compact?: boolean;
  /** Render with the input already open (e.g. subtask entry). */
  startActive?: boolean;
  /** Called when the input closes without creating anything. */
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  const [active, setActive] = useState(startActive ?? false);
  const [text, setText] = useState('');

  const dismiss = () => {
    setActive(false);
    onDismiss?.();
  };

  const submit = () => {
    const title = text.trim();
    setText('');
    dismiss();
    if (title) onSubmit(title);
  };

  if (active) {
    return (
      <View
        style={[
          styles.row,
          compact && styles.rowCompact,
          dashed ? styles.dashed : styles.solid,
          { borderColor: theme.border, backgroundColor: theme.card },
        ]}
      >
        <SymbolView
          name="plus"
          size={compact ? 15 : 18}
          tintColor={theme.textSecondary}
          fallback={<ThemedText themeColor="textSecondary">+</ThemedText>}
        />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          onBlur={dismiss}
          placeholder={label}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            compact && styles.inputCompact,
            { color: theme.text, fontFamily: Fonts.sans },
          ]}
          autoFocus
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
        />
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => setActive(true)}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        dashed ? styles.dashed : styles.solid,
        { borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <SymbolView
        name="plus"
        size={compact ? 15 : 18}
        tintColor={theme.textSecondary}
        fallback={<ThemedText themeColor="textSecondary">+</ThemedText>}
      />
      <ThemedText type={compact ? 'small' : 'default'} themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    minHeight: 56,
  },
  rowCompact: {
    minHeight: 40,
    borderRadius: 12,
  },
  dashed: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  solid: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.three,
  },
  inputCompact: {
    fontSize: 14,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
