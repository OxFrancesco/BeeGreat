import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Markdown } from '@/components/agent/markdown';
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

/** Long-press-to-copy with a transient "Copied" acknowledgement. */
function useCopyToClipboard(value?: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async () => {
    if (!value?.trim()) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    await Clipboard.setStringAsync(value);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [value]);
  return { copied, copy };
}

function CopiedBadge() {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.copied}>
      Copied
    </ThemedText>
  );
}

export function MessageContent({
  from,
  showSpeaker = true,
  copyText,
  children,
}: PropsWithChildren<{
  from: MessageRole;
  showSpeaker?: boolean;
  copyText?: string;
}>) {
  const theme = useTheme();
  const { copied, copy } = useCopyToClipboard(copyText);
  if (from === 'user') {
    return (
      <View style={styles.userStack}>
        {showSpeaker ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.userLabel}>
            You
          </ThemedText>
        ) : null}
        <Pressable
          accessibilityHint={copyText ? 'Long press to copy' : undefined}
          disabled={!copyText}
          onLongPress={() => void copy()}
          style={[
            styles.bubble,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          {children}
        </Pressable>
        {copied ? <CopiedBadge /> : null}
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
        <Pressable
          accessibilityHint={copyText ? 'Long press to copy' : undefined}
          disabled={!copyText}
          onLongPress={() => void copy()}
          style={styles.assistantContent}
        >
          {children}
        </Pressable>
        {copied ? <CopiedBadge /> : null}
      </View>
    </View>
  );
}

export function MessageText({ from, text }: { from: MessageRole; text: string }) {
  if (from === 'assistant') {
    return <Markdown>{text}</Markdown>;
  }
  return (
    <ThemedText themeColor="secondaryForeground" style={styles.userText}>
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
  copied: {
    paddingHorizontal: Spacing.one,
    fontSize: 12,
    lineHeight: 14,
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
    gap: Spacing.one,
  },
  assistantContent: {
    flex: 1,
    gap: Spacing.two,
    minWidth: 0,
  },
  userText: {
    fontSize: 16,
    lineHeight: 23,
  },
});
