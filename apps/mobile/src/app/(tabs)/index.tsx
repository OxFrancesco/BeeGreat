import { useUser } from '@clerk/clerk-expo';
import type { FlueConversationMessage, FlueConversationPart } from '@flue/react';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Conversation } from '@/components/agent/conversation';
import { GeneratedUI } from '@/components/agent/generated-ui';
import { Message, MessageContent, MessageText } from '@/components/agent/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/agent/reasoning';
import { Suggestion, Suggestions } from '@/components/agent/suggestion';
import { ToolActivity } from '@/components/agent/tool';
import { FloatingBee } from '@/components/floating-bee';
import { HexAvatar } from '@/components/hex-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { onMicPress } from '@/lib/mic-bus';
import { extractBeeUI } from '@/lib/ui-spec';

const HERO_SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
];

export default function VoiceAgentScreen() {
  const agent = useVoiceAgent();
  const { user } = useUser();
  const hasConversation = agent.messages.length > 0;

  // The mic lives in the tab bar; its trigger emits presses through the bus.
  const { toggleRecording } = agent;
  useEffect(() => onMicPress(toggleRecording), [toggleRecording]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
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
        <View style={styles.flex}>
          {hasConversation ? (
            <Conversation>
              {agent.messages.map((message, index) => (
                <AgentMessage
                  key={message.id}
                  message={message}
                  isLast={index === agent.messages.length - 1}
                  isBusy={agent.busy}
                />
              ))}
            </Conversation>
          ) : (
            <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
              <FloatingBee height={120} />
              <Suggestions>
                {HERO_SUGGESTIONS.map((suggestion) => (
                  <Suggestion key={suggestion} suggestion={suggestion} onPress={agent.sendText} />
                ))}
              </Suggestions>
            </Animated.View>
          )}

          {agent.recording ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              Listening — tap the mic again to send
            </ThemedText>
          ) : null}

          {agent.voiceError || agent.error ? (
            <ThemedText type="small" themeColor="destructive" style={styles.centered}>
              {agent.voiceError ?? agent.error?.message}
            </ThemedText>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

type ToolPart = Extract<FlueConversationPart, { type: 'dynamic-tool' }>;

function AgentMessage({
  message,
  isLast,
  isBusy,
}: {
  message: FlueConversationMessage;
  isLast: boolean;
  isBusy: boolean;
}) {
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  if (message.role === 'user') {
    return (
      <Message from="user">
        <MessageContent from="user">
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

  if (!spoken && components.length === 0 && !reasoningText && toolParts.length === 0) {
    return null;
  }

  return (
    <Message from="assistant">
      <MessageContent from="assistant">
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
            state={
              part.state === 'input-available'
                ? 'running'
                : part.state === 'output-error'
                  ? 'error'
                  : 'done'
            }
          />
        ))}
        {spoken ? <MessageText from="assistant" text={spoken} /> : null}
        <GeneratedUI components={components} />
      </MessageContent>
    </Message>
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
  flex: {
    flex: 1,
    gap: Spacing.two,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: Spacing.one,
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
  centered: {
    textAlign: 'center',
  },
});
