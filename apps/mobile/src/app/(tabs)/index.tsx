import { useUser } from '@clerk/clerk-expo';
import type { FlueConversationMessage, FlueConversationPart } from '@flue/react';
import { router } from 'expo-router';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Conversation } from '@/components/agent/conversation';
import { GeneratedUI } from '@/components/agent/generated-ui';
import { Message, MessageContent, MessageText } from '@/components/agent/message';
import { PromptInput } from '@/components/agent/prompt-input';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/agent/reasoning';
import { Suggestion, Suggestions } from '@/components/agent/suggestion';
import { ThinkingActivity, ToolActivity } from '@/components/agent/tool';
import { useVoiceAgentContext } from '@/components/agent/voice-agent-provider';
import { FloatingBee } from '@/components/floating-bee';
import { HexAvatar } from '@/components/hex-avatar';
import { HexIconButton } from '@/components/hex-icon-button';
import { CurrencyBar } from '@/components/hive/currency-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { extractBeeUI } from '@/lib/ui-spec';

const HERO_SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
];

export default function VoiceAgentScreen() {
  const agent = useVoiceAgentContext();
  const { user } = useUser();
  const { height, width } = useWindowDimensions();
  const hasConversation = agent.messages.length > 0;
  // Keep the hero comfortable on small iPhones (SE) without shrinking it on Pro Max.
  const compact = height < 700;

  // "Thinking…" bridges the gap between sending a message and the first
  // visible output (tool row, reasoning, or text) from the assistant.
  const lastMessage = agent.messages.at(-1);
  const awaitingReply =
    agent.busy &&
    (lastMessage?.role !== 'assistant' ||
      !lastMessage.parts.some(
        (part) =>
          part.type === 'dynamic-tool' ||
          part.type === 'reasoning' ||
          (part.type === 'text' && part.text.length > 0),
      ));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={[styles.safeArea, width < 380 && styles.safeAreaCompact]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        >
        {/* Keyboard dismissal: taps inside the conversation dismiss it via the
            ScrollView's default keyboardShouldPersistTaps, and the hero screen
            has its own dismiss wrapper below. Never wrap the conversation in a
            Touchable — it steals the scroll gesture. */}
        <View style={styles.topBar}>
          <HexIconButton
            size={36}
            icon="line.3.horizontal"
            fallbackGlyph="≡"
            accessibilityLabel="Conversations"
            onPress={() => router.push('/threads')}
          />
          <CurrencyBar />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            hitSlop={Spacing.two}
            onPress={() => router.push('/profile')}
            style={({ pressed }) => pressed && styles.topBarPressed}
          >
            <HexAvatar size={36} uri={user?.hasImage ? user.imageUrl : null} />
          </Pressable>
        </View>

        {hasConversation ? (
          <Conversation>
            {agent.messages.map((message, index) => (
              <AgentMessage
                key={message.id}
                message={message}
                showSpeaker={
                  index === 0 || agent.messages[index - 1]?.role !== message.role
                }
                isLast={index === agent.messages.length - 1}
                isBusy={agent.busy}
                onReply={agent.sendText}
              />
            ))}
            {awaitingReply ? <ThinkingActivity /> : null}
          </Conversation>
        ) : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[styles.hero, compact && styles.heroCompact]}
            >
              <FloatingBee height={compact ? 96 : 120} />
              <Suggestions>
                {HERO_SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onPress={agent.sendText}
                  />
                ))}
              </Suggestions>
            </Animated.View>
          </TouchableWithoutFeedback>
        )}

        {agent.recording || agent.errorMessage ? (
          <View style={styles.status}>
            {agent.recording ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                Listening — tap Talk again to send
              </ThemedText>
            ) : null}
            {agent.errorMessage ? (
              <ThemedText
                selectable
                type="small"
                themeColor="destructive"
                style={styles.centered}
              >
                {agent.errorMessage}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.composer}>
          <PromptInput onSubmit={agent.sendText} disabled={agent.busy} />
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

type ToolPart = Extract<FlueConversationPart, { type: 'dynamic-tool' }>;

function AgentMessage({
  message,
  showSpeaker,
  isLast,
  isBusy,
  onReply,
}: {
  message: FlueConversationMessage;
  showSpeaker: boolean;
  isLast: boolean;
  isBusy: boolean;
  onReply?: (text: string) => void;
}) {
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  if (message.role === 'user') {
    return (
      <Message from="user">
        <MessageContent from="user" showSpeaker={showSpeaker}>
          <MessageText from="user" text={text} />
        </MessageContent>
      </Message>
    );
  }

  const reasoningText = message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n\n');
  const lastPart = message.parts.at(-1);
  const reasoningStreaming =
    isLast && isBusy && lastPart?.type === 'reasoning' && lastPart.state === 'streaming';
  const toolParts = message.parts.filter((part): part is ToolPart => part.type === 'dynamic-tool');

  const textStreaming = message.parts.some(
    (part) => part.type === 'text' && part.state === 'streaming',
  );
  // Hide a beeui block until it finishes streaming, then render it as native UI.
  const visible = textStreaming ? text.split('```beeui')[0] : text;
  const { spoken, components } = extractBeeUI(visible);
  const hasResponse = Boolean(spoken || components.length > 0);
  const hasActivity = Boolean(reasoningText || toolParts.length > 0);

  if (!hasResponse && !hasActivity) {
    return null;
  }

  return (
    <View style={styles.assistantTurn}>
      {hasActivity ? (
        <View style={styles.activityGroup}>
          {reasoningText ? (
            <Reasoning isStreaming={reasoningStreaming}>
              <ReasoningTrigger />
              <ReasoningContent>{reasoningText}</ReasoningContent>
            </Reasoning>
          ) : null}
          {toolParts.map((part) => (
            <ToolActivity
              key={part.toolCallId}
              name={part.toolName}
              input={part.input}
              output={'output' in part ? part.output : undefined}
              errorText={'errorText' in part ? part.errorText : undefined}
              state={
                part.state === 'input-available'
                  ? 'running'
                  : part.state === 'output-error'
                    ? 'error'
                    : 'done'
              }
            />
          ))}
        </View>
      ) : null}
      {hasResponse ? (
        <Message from="assistant">
          <MessageContent from="assistant" showSpeaker>
            {spoken ? <MessageText from="assistant" text={spoken} /> : null}
            <GeneratedUI components={components} onReply={onReply} />
          </MessageContent>
        </Message>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  safeAreaCompact: {
    paddingHorizontal: Spacing.two + Spacing.one,
  },
  flex: {
    flex: 1,
    gap: Spacing.two,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  topBarPressed: {
    opacity: 0.7,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  heroCompact: {
    gap: Spacing.four,
  },
  status: {
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  composer: {
    paddingTop: Spacing.one,
  },
  centered: {
    textAlign: 'center',
  },
  assistantTurn: {
    gap: Spacing.three,
  },
  activityGroup: {
    gap: Spacing.two,
  },
});
