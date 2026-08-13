import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { VoiceOrb } from '@/components/agent/voice-orb';
import { useVoiceAgentContext } from '@/components/agent/voice-agent-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STATUS_COPY = {
  disconnected: 'Ready for a live conversation',
  connecting: 'Connecting to Grok Voice…',
  listening: 'Listening — just speak',
  thinking: 'Thinking…',
  speaking: 'Bee is speaking',
  error: 'Conversation paused',
} as const;

export default function VoiceConversationScreen() {
  const { conversation } = useVoiceAgentContext();
  const theme = useTheme();
  const { start, stop } = conversation;

  useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  const endConversation = () => {
    conversation.stop();
    router.back();
  };

  return (
    // Keep the wrapper in the native tree so react-native-screens can size the
    // ScrollView correctly inside an iOS form sheet.
    <ThemedView style={styles.container} collapsable={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <VoiceOrb
            state={conversation.orbState}
            onPress={
              conversation.isActive
                ? endConversation
                : () => void conversation.start()
            }
          />
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.status,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    conversation.status === 'error'
                      ? theme.destructive
                      : theme.primary,
                },
              ]}
            />
            <ThemedText type="smallBold" selectable>
              {STATUS_COPY[conversation.status]}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.hint}
            selectable
          >
            Live speech-to-speech with Grok Think Fast 2.0. This mode is for
            conversation; use Voice note when Bee needs your goals, tasks, or
            tools.
          </ThemedText>
        </View>

        {conversation.turns.length > 0 ? (
          <View style={styles.timeline}>
            {conversation.turns.map((turn) => (
              <View
                key={turn.id}
                style={[
                  styles.turn,
                  turn.role === 'user'
                    ? [
                        styles.userTurn,
                        { backgroundColor: theme.secondary },
                      ]
                    : [
                        styles.assistantTurn,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                      ],
                ]}
              >
                <ThemedText
                  type="smallBold"
                  style={
                    turn.role === 'user'
                      ? { color: theme.secondaryForeground }
                      : undefined
                  }
                >
                  {turn.role === 'user' ? 'You' : 'Bee · Grok Voice'}
                </ThemedText>
                <ThemedText
                  selectable
                  style={
                    turn.role === 'user'
                      ? { color: theme.secondaryForeground }
                      : undefined
                  }
                >
                  {turn.text || '…'}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {conversation.errorMessage ? (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <SymbolView
              name="exclamationmark.bubble.fill"
              size={18}
              tintColor={theme.destructive}
            />
            <View style={styles.errorCopy}>
              <ThemedText type="smallBold">Bee couldn’t connect</ThemedText>
              <ThemedText selectable type="small" themeColor="textSecondary">
                {conversation.errorMessage}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            conversation.isActive
              ? 'End live conversation'
              : 'Start live conversation'
          }
          onPress={
            conversation.isActive
              ? endConversation
              : () => void conversation.start()
          }
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: conversation.isActive
                ? theme.backgroundElement
                : theme.primary,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText
            type="smallBold"
            style={
              conversation.isActive
                ? undefined
                : { color: theme.primaryForeground }
            }
          >
            {conversation.isActive ? 'End conversation' : 'Try again'}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  status: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hint: {
    maxWidth: 420,
    textAlign: 'center',
  },
  timeline: {
    gap: Spacing.two,
  },
  turn: {
    maxWidth: '88%',
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  userTurn: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantTurn: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  errorCopy: { flex: 1, gap: Spacing.one },
  action: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  pressed: {
    opacity: 0.72,
  },
});
