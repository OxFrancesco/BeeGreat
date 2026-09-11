import type { FlueConversationMessage } from '@flue/react';
import type { LegendListRenderItemProps } from '@legendapp/list/react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/agent/attachments';
import { Conversation } from '@/components/agent/conversation';
import { PreviewGeneratedUI as GeneratedUI } from './preview-generated-ui';
import { ListeningIsland } from '@/components/agent/listening-island';
import { Markdown } from '@/components/agent/markdown';
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
import { Shimmer } from '@/components/agent/shimmer';
import { Suggestion, Suggestions } from '@/components/agent/suggestion';
import { ThinkingActivity, ToolActivity } from '@/components/agent/tool';
import { VoiceOrb, type OrbState } from '@/components/agent/voice-orb';
import { Spacing } from '@/constants/theme';
import { extractBeeUI } from '@/lib/ui-spec';
import { useTheme } from '@/hooks/use-theme';

import {
  ATTACHMENTS,
  CONVERSATION_MESSAGES,
  MARKDOWN_SAMPLE,
} from './fixtures';
import {
  Section,
  Specimen,
  useReplySink,
  Variant,
  VariantRow,
} from './specimen';

const SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
];

const ORB_STATES: OrbState[] = ['idle', 'listening', 'thinking', 'speaking'];
const ORB_SIZE = 208;
const ORB_SCALE = 0.55;

export function ChatSection() {
  const reply = useReplySink();
  const theme = useTheme();
  const [attachments, setAttachments] = useState(ATTACHMENTS);

  const renderPlaygroundMessage = useCallback(
    ({
      item,
      index,
      data,
    }: LegendListRenderItemProps<FlueConversationMessage>) => (
      <PlaygroundMessage
        message={item}
        showSpeaker={index === 0 || data[index - 1]?.role !== item.role}
        onReply={reply.onReply}
      />
    ),
    [reply.onReply],
  );

  const renderComposer = useCallback(
    (onSubmit: (text: string) => void | Promise<void>) => (
      <PromptInput onSubmit={onSubmit} />
    ),
    [],
  );

  return (
    <Section
      title="Chat surface"
      description="The voice-first conversation: messages, activity, input, and the orb. Interactive controls echo what they would send to Bee below themselves."
    >
      <Specimen name='<Message from="user">'>
        <Message from="user">
          <MessageContent from="user" copyText="What should I focus on today?">
            <MessageText from="user" text="What should I focus on today?" />
          </MessageContent>
        </Message>
      </Specimen>

      <Specimen
        name='<Message from="assistant">'
        note="Markdown body, settled bee avatar"
      >
        <Message from="assistant">
          <MessageContent
            from="assistant"
            copyText="Your sharpest edge today is the component playground."
          >
            <MessageText
              from="assistant"
              text="Your sharpest edge today is the **component playground** — every tweak to the chat surface is visible in one place."
            />
          </MessageContent>
        </Message>
      </Specimen>

      <Specimen
        name="<MessageContent showSpeaker={false} animateBee>"
        note="Thinking bee"
      >
        <Message from="assistant">
          <MessageContent
            from="assistant"
            showSpeaker={false}
            beeAnimation="thinking"
            animateBee
          >
            <MessageText from="assistant" text="Working on it…" />
          </MessageContent>
        </Message>
      </Specimen>

      <Specimen name="<Markdown>">
        <Markdown>{MARKDOWN_SAMPLE}</Markdown>
      </Specimen>

      <Specimen name="<PromptInput>" note="Try / for commands">
        <PromptInput onSubmit={reply.onReply} />
      </Specimen>

      <Specimen name="<Suggestions><Suggestion>">
        <Suggestions>
          {SUGGESTIONS.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onPress={reply.onReply}
            />
          ))}
        </Suggestions>
      </Specimen>

      <Specimen name='<ToolActivity state="running">'>
        <ToolActivity
          name="search_mind"
          state="running"
          input={{ query: 'playground ideas' }}
        />
      </Specimen>

      <Specimen
        name='<ToolActivity state="done">'
        note="Tap to expand the call"
      >
        <ToolActivity
          name="list_tasks"
          state="done"
          input={{ goalId: 'fixture-goal' }}
          output={{ tasks: [{ title: 'Ship the playground', status: 'todo' }] }}
        />
      </Specimen>

      <Specimen name='<ToolActivity state="error">'>
        <ToolActivity
          name="save_bookmark"
          state="error"
          input={{ url: 'https://docs.expo.dev' }}
          errorText="The bookmark service timed out."
        />
      </Specimen>

      <Specimen name='<ToolActivity name="task">' note="Devin specialist cell">
        <ToolActivity
          name="task"
          state="running"
          input={{ agent: 'devin', prompt: 'Review the playground diff' }}
        />
      </Specimen>

      <Specimen
        name='<ToolActivity name="sugar_quote">'
        note="Web3 power-up badge"
      >
        <ToolActivity
          name="sugar_quote"
          state="done"
          input={{ fromToken: 'USDC', toToken: 'AERO', amount: '25' }}
          output={{ amountOut: '41.2', chain: 'base' }}
        />
      </Specimen>

      <Specimen name="<ThinkingActivity>">
        <ThinkingActivity />
      </Specimen>

      <Specimen
        name="<Reasoning isStreaming>"
        note="Auto-opens while streaming"
      >
        <Reasoning isStreaming>
          <ReasoningTrigger />
          <ReasoningContent>
            Checking open goals, then ranking tasks by due date before picking
            one focus.
          </ReasoningContent>
        </Reasoning>
      </Specimen>

      <Specimen name="<Reasoning>" note="Settled disclosure">
        <Reasoning>
          <ReasoningTrigger />
          <ReasoningContent>
            Checked goals, found four open tasks, picked the one blocking the
            release.
          </ReasoningContent>
        </Reasoning>
      </Specimen>

      <Specimen name="<Shimmer>">
        <Shimmer type="small" themeColor="textSecondary">
          Working on it…
        </Shimmer>
      </Specimen>

      <Specimen
        name='<Attachments variant="grid">'
        note="Remove button on the image tile"
      >
        <Attachments variant="grid">
          {attachments.map((attachment) => (
            <Attachment
              key={attachment.id}
              data={attachment}
              onRemove={
                attachment.id === 'fixture-att-1'
                  ? () =>
                      setAttachments((current) =>
                        current.filter((item) => item.id !== attachment.id),
                      )
                  : undefined
              }
            >
              <AttachmentPreview />
              <AttachmentRemove />
            </Attachment>
          ))}
        </Attachments>
      </Specimen>

      <Specimen name='<Attachments variant="inline">'>
        <Attachments variant="inline">
          {ATTACHMENTS.map((attachment) => (
            <Attachment key={attachment.id} data={attachment}>
              <AttachmentPreview />
              <AttachmentInfo />
            </Attachment>
          ))}
        </Attachments>
      </Specimen>

      <Specimen name='<Attachments variant="list">'>
        <Attachments variant="list">
          {ATTACHMENTS.map((attachment) => (
            <Attachment key={attachment.id} data={attachment}>
              <AttachmentPreview />
              <AttachmentInfo showMediaType />
            </Attachment>
          ))}
        </Attachments>
      </Specimen>

      <Specimen name="<VoiceOrb>" note="All four states, scaled 55%">
        <VariantRow>
          {ORB_STATES.map((state) => (
            <Variant key={state} label={state}>
              <View style={styles.orbScale}>
                <VoiceOrb state={state} onPress={() => {}} />
              </View>
            </Variant>
          ))}
        </VariantRow>
      </Specimen>

      <Specimen
        name="<ListeningIsland>"
        note="Absolute-positioned pill, framed here"
      >
        <VariantRow>
          {ORB_STATES.filter((state) => state !== 'idle').map((state) => (
            <Variant key={state} label={state}>
              <View
                style={[
                  styles.islandFrame,
                  { borderColor: theme.border, backgroundColor: theme.card },
                ]}
              >
                <SafeAreaInsetsContext.Provider
                  value={{ top: 0, bottom: 0, left: 0, right: 0 }}
                >
                  <ListeningIsland state={state} onPress={() => {}} />
                </SafeAreaInsetsContext.Provider>
              </View>
            </Variant>
          ))}
        </VariantRow>
      </Specimen>

      <Specimen
        name="<Conversation>"
        note="Virtualized transcript + composer, live fixtures"
      >
        <View
          style={[
            styles.conversationFrame,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          <Conversation
            data={CONVERSATION_MESSAGES}
            dataKey="playground"
            keyExtractor={(message) => message.id}
            getItemType={(message) => message.role}
            renderItem={renderPlaygroundMessage}
            renderComposer={renderComposer}
            onSubmit={reply.onReply}
            footer={<ThinkingActivity />}
            contentContainerStyle={styles.conversationContent}
          />
        </View>
      </Specimen>
      {reply.sink}
    </Section>
  );
}

type ToolPart = Extract<
  FlueConversationMessage['parts'][number],
  { type: 'dynamic-tool' }
>;

/**
 * Mirrors `AgentMessage` in (tabs)/index.tsx: reasoning and tool calls above
 * the reply, spoken markdown plus generated UI inside the message.
 */
function PlaygroundMessage({
  message,
  showSpeaker,
  onReply,
}: {
  message: FlueConversationMessage;
  showSpeaker: boolean;
  onReply?: (text: string) => void;
}) {
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  if (message.role === 'user') {
    return (
      <Message from="user">
        <MessageContent from="user" showSpeaker={showSpeaker} copyText={text}>
          <MessageText from="user" text={text} />
        </MessageContent>
      </Message>
    );
  }

  if (message.role !== 'assistant') return null;

  const reasoningText = message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n\n');
  const lastPart = message.parts.at(-1);
  const reasoningStreaming =
    lastPart?.type === 'reasoning' && lastPart.state === 'streaming';
  const toolParts = message.parts.filter(
    (part): part is ToolPart => part.type === 'dynamic-tool',
  );
  const { spoken, components } = extractBeeUI(text);

  return (
    <View style={styles.assistantTurn}>
      {reasoningText || toolParts.length > 0 ? (
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
      {spoken || components.length > 0 ? (
        <Message from="assistant">
          <MessageContent
            from="assistant"
            showSpeaker={showSpeaker}
            copyText={spoken || undefined}
          >
            {spoken ? <MessageText from="assistant" text={spoken} /> : null}
            <GeneratedUI components={components} onReply={onReply} />
          </MessageContent>
        </Message>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  orbScale: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    transform: [{ scale: ORB_SCALE }],
    // Scale shrinks the visual but not the layout box; equal negative margins
    // pull the footprint in to match.
    margin: (-ORB_SIZE * (1 - ORB_SCALE)) / 2,
  },
  islandFrame: {
    height: 64,
    width: 168,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  conversationFrame: {
    height: 520,
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  conversationContent: {
    padding: Spacing.three,
  },
  assistantTurn: {
    gap: Spacing.two,
  },
  activityGroup: {
    gap: Spacing.two,
  },
});
