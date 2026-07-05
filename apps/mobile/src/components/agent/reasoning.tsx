import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';

import { Shimmer } from '@/components/agent/shimmer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * RN port of the ai-elements Reasoning component: collapsible thinking that
 * auto-opens while streaming and closes itself once the model moves on.
 */

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration?: number;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export function useReasoning() {
  const context = useContext(ReasoningContext);
  if (!context) throw new Error('Reasoning subcomponents must render inside <Reasoning>.');
  return context;
}

const AUTO_CLOSE_DELAY = 800;

export function Reasoning({
  isStreaming = false,
  defaultOpen = false,
  children,
}: PropsWithChildren<{ isStreaming?: boolean; defaultOpen?: boolean }>) {
  // `userOpen` overrides the automatic behavior once the user toggles manually.
  const [userOpen, setUserOpen] = useState<boolean | undefined>(undefined);
  const [autoClosed, setAutoClosed] = useState(false);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);

  // Sanctioned "adjust state during render" pattern for streaming transitions.
  const [prevStreaming, setPrevStreaming] = useState(isStreaming);
  if (isStreaming !== prevStreaming) {
    setPrevStreaming(isStreaming);
    if (isStreaming) {
      setStartedAt((current) => current ?? Date.now());
    }
  }

  useEffect(() => {
    if (isStreaming || startedAt === undefined) return;
    const endedAt = Date.now();
    const timer = setTimeout(() => {
      setDuration(Math.max(1, Math.round((endedAt - startedAt) / 1000)));
      setAutoClosed(true);
    }, AUTO_CLOSE_DELAY);
    return () => clearTimeout(timer);
  }, [isStreaming, startedAt]);

  const hasStreamed = startedAt !== undefined;
  const isOpen = userOpen ?? (hasStreamed ? isStreaming || !autoClosed : defaultOpen);

  return (
    <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen: setUserOpen, duration }}>
      <View style={styles.root}>{children}</View>
    </ReasoningContext.Provider>
  );
}

export function ReasoningTrigger() {
  const { isStreaming, isOpen, setIsOpen, duration } = useReasoning();
  const theme = useTheme();
  const label = isStreaming
    ? 'Thinking…'
    : duration
      ? `Thought for ${duration}s`
      : 'Thoughts';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isOpen ? 'Hide reasoning' : 'Show reasoning'}
      onPress={() => setIsOpen(!isOpen)}
      style={styles.trigger}
      hitSlop={4}
    >
      <View style={[styles.iconBadge, { backgroundColor: theme.secondary }]}>
        <SymbolView
          name="brain"
          size={11}
          tintColor={theme.secondaryForeground}
          fallback={<ThemedText type="small" themeColor="secondaryForeground">~</ThemedText>}
        />
      </View>
      {isStreaming ? (
        <Shimmer type="small" themeColor="textSecondary">
          {label}
        </Shimmer>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      )}
      <SymbolView
        name={isOpen ? 'chevron.up' : 'chevron.down'}
        size={10}
        tintColor={theme.textSecondary}
        fallback={<ThemedText type="small" themeColor="textSecondary">{isOpen ? '^' : 'v'}</ThemedText>}
      />
    </Pressable>
  );
}

export function ReasoningContent({ children }: { children: string }) {
  const { isOpen } = useReasoning();
  const theme = useTheme();
  if (!isOpen) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      style={[styles.content, { borderLeftColor: theme.border }]}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {children}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.one,
    alignSelf: 'stretch',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.two,
    marginLeft: Spacing.half,
  },
});
