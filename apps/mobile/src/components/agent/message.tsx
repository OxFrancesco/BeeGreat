import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { FloatingBee } from '@/components/floating-bee';
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

export function MessageContent({
  from,
  showSpeaker = true,
  children,
}: PropsWithChildren<{ from: MessageRole; showSpeaker?: boolean }>) {
  const theme = useTheme();
  if (from === 'user') {
    return (
      <View style={styles.userStack}>
        {showSpeaker ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.userLabel}>
            You
          </ThemedText>
        ) : null}
        <View
          style={[
            styles.bubble,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.assistantRow}>
      {showSpeaker ? (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="Bee"
          style={styles.assistantAvatar}
        >
          <FloatingBee height={36} />
        </View>
      ) : (
        <View style={styles.assistantAvatarSpacer} />
      )}
      <View style={styles.assistantStack}>
        <View style={styles.assistantContent}>{children}</View>
      </View>
    </View>
  );
}

export function MessageText({ from, text }: { from: MessageRole; text: string }) {
  return (
    <ThemedText
      selectable
      themeColor={from === 'user' ? 'secondaryForeground' : 'text'}
      style={from === 'assistant' ? styles.assistantText : styles.userText}
    >
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
    paddingLeft: Spacing.five,
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  userStack: {
    maxWidth: '88%',
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  userLabel: {
    paddingRight: Spacing.one,
    fontSize: 12,
    lineHeight: 14,
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    borderBottomRightRadius: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  assistantRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    minWidth: 0,
  },
  assistantAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantAvatarSpacer: {
    width: 36,
  },
  assistantStack: {
    flex: 1,
    minWidth: 0,
  },
  assistantContent: {
    flex: 1,
    gap: Spacing.two,
    minWidth: 0,
  },
  assistantText: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400',
  },
  userText: {
    fontSize: 16,
    lineHeight: 23,
  },
});
