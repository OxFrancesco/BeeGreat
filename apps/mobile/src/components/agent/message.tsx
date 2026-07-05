import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MessageRole = 'user' | 'assistant';

/**
 * Chat message layout, ported from ai-elements Message: user messages sit in
 * a honey-tinted bubble on the right, assistant messages flow full-width.
 */
export function Message({ from, children }: PropsWithChildren<{ from: MessageRole }>) {
  return (
    <View style={[styles.row, from === 'user' ? styles.rowUser : styles.rowAssistant]}>
      {children}
    </View>
  );
}

export function MessageContent({ from, children }: PropsWithChildren<{ from: MessageRole }>) {
  const theme = useTheme();
  if (from === 'user') {
    return (
      <View style={[styles.bubble, { backgroundColor: theme.secondary }]}>{children}</View>
    );
  }
  return <View style={styles.assistantContent}>{children}</View>;
}

export function MessageText({ from, text }: { from: MessageRole; text: string }) {
  return (
    <ThemedText themeColor={from === 'user' ? 'secondaryForeground' : 'text'}>{text}</ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
    paddingLeft: Spacing.six,
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Spacing.three,
    borderBottomRightRadius: Spacing.one,
    maxWidth: '100%',
  },
  assistantContent: {
    flex: 1,
    gap: Spacing.two,
  },
});
