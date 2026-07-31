import { useUser } from '@clerk/clerk-expo';
import type {
  FlueConversationMessage,
  FlueConversationPart,
} from '@flue/react';
import type { LegendListRenderItemProps } from '@legendapp/list/react-native';
import { router } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { Conversation } from '@/components/agent/conversation';
import { GeneratedUI } from '@/components/agent/generated-ui';
import {
  Message,
  MessageContent,
  MessageText,
} from '@/components/agent/message';
import { PromptInput } from '@/components/agent/prompt-input';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/agent/reasoning';
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
import {
  useScreenshotFixture,
  type ScreenshotAgentState,
} from '@/lib/screenshot-fixture';

const HERO_SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
];

const messageKeyExtractor = (message: FlueConversationMessage) => message.id;
const getMessageType = (message: FlueConversationMessage) => message.role;

type VoiceAgentScreenState = ScreenshotAgentState & {
  thread?: number;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  loadOlder?: () => void | Promise<void>;
  toggleRecording?: () => void | Promise<void>;
};

export default function VoiceAgentScreen() {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return (
      <VoiceAgentScreenView
        agent={fixture.agent}
        avatarUri={null}
        profileEnabled={false}
      />
    );
  }

  return <LiveVoiceAgentScreen />;
}

function LiveVoiceAgentScreen() {
  const agent = useVoiceAgentContext();
  const { user } = useUser();
  return (
    <VoiceAgentScreenView
      agent={agent}
      avatarUri={user?.hasImage ? user.imageUrl : null}
    />
  );
}

export function VoiceAgentScreenView({
  agent,
  avatarUri,
  profileEnabled = true,
}: {
  agent: VoiceAgentScreenState;
  avatarUri: string | null;
  profileEnabled?: boolean;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  const renderMessage = useCallback(
    ({
      item,
      index,
      data,
    }: LegendListRenderItemProps<FlueConversationMessage>) => (
      <AgentMessage
        message={item}
        showSpeaker={index === 0 || data[index - 1]?.role !== item.role}
        isLast={index === data.length - 1}
        isBusy={agent.busy}
        onReply={agent.sendText}
      />
    ),
    [agent.busy, agent.sendText],
  );

  const renderComposer = useCallback(
    (onSubmit: (text: string) => void | Promise<void>) => (
      <AgentComposer
        busy={agent.busy}
        errorMessage={agent.errorMessage}
        onSubmit={onSubmit}
        recording={agent.recording}
      />
    ),
    [agent.busy, agent.errorMessage, agent.recording],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={[styles.safeArea, width < 380 && styles.safeAreaCompact]}
      >
        <View style={styles.flex}>
          {/* Keyboard dismissal: taps inside the conversation dismiss it via the
            list's keyboardShouldPersistTaps, and the hero screen
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
              accessibilityState={{ disabled: !profileEnabled }}
              disabled={!profileEnabled}
              hitSlop={Spacing.two}
              onPress={() => router.push('/profile')}
              style={({ pressed }) => pressed && styles.topBarPressed}
            >
              <HexAvatar size={36} uri={avatarUri} />
            </Pressable>
          </View>

          {hasConversation ? (
            <Conversation
              key={`thread:${agent.thread ?? 'fixture'}`}
              canLoadOlder={agent.canLoadOlder}
              data={agent.messages}
              dataKey={agent.thread ?? 'fixture'}
              footer={awaitingReply ? <ThinkingActivity /> : null}
              getItemType={getMessageType}
              header={
                agent.loadingOlder ? (
                  <View
                    accessibilityLabel="Loading earlier messages"
                    accessibilityRole="progressbar"
                    style={styles.historyLoader}
                  >
                    <ActivityIndicator size="small" />
                  </View>
                ) : null
              }
              keyExtractor={messageKeyExtractor}
              loadingOlder={agent.loadingOlder}
              onLoadOlder={agent.loadOlder}
              onSubmit={agent.sendText}
              renderComposer={renderComposer}
              renderItem={renderMessage}
            />
          ) : (
            <>
              <TouchableWithoutFeedback
                onPress={Keyboard.dismiss}
                accessible={false}
              >
                <Animated.View
                  entering={FadeIn.duration(400)}
                  style={[styles.hero, compact && styles.heroCompact]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      agent.recording ? 'Stop and send' : 'Talk to Bee'
                    }
                    disabled={!agent.toggleRecording}
                    onPress={() => {
                      Keyboard.dismiss();
                      void agent.toggleRecording?.();
                    }}
                    style={({ pressed }) =>
                      pressed && styles.heroBeePressed
                    }
                  >
                    <FloatingBee height={compact ? 96 : 120} />
                  </Pressable>
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
              <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
                {renderComposer(agent.sendText)}
              </KeyboardStickyView>
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function AgentComposer({
  busy,
  errorMessage,
  onSubmit,
  recording,
}: {
  busy: boolean;
  errorMessage?: string;
  onSubmit: (text: string) => void | Promise<void>;
  recording: boolean;
}) {
  return (
    <View style={styles.composer}>
      {recording || errorMessage ? (
        <View style={styles.status}>
          {recording ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.centered}
            >
              Listening — tap Talk again to send
            </ThemedText>
          ) : null}
          {errorMessage ? (
            <ThemedText
              selectable
              type="small"
              themeColor="destructive"
              style={styles.centered}
            >
              {errorMessage}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <PromptInput onSubmit={onSubmit} disabled={busy} />
    </View>
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
    isLast &&
    isBusy &&
    lastPart?.type === 'reasoning' &&
    lastPart.state === 'streaming';
  const toolParts = message.parts.filter(
    (part): part is ToolPart => part.type === 'dynamic-tool',
  );

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
  heroBeePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  historyLoader: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  status: {
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  composer: {
    gap: Spacing.one,
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
