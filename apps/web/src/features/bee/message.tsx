import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import { extractBeeUI } from './bee-ui'
import { GeneratedUI } from './generated-ui'
import { getToolCopy } from './tool-labels'
import type { FlueConversationMessage, FlueConversationPart } from '@flue/react'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '~/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '~/components/ai-elements/reasoning'
import { Shimmer } from '~/components/ai-elements/shimmer'
import {
  Tool,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '~/components/ai-elements/tool'
import { CollapsibleTrigger } from '~/components/ui/collapsible'

export function AgentMessage({
  message,
  isLast,
  busy,
  onReply,
  onRetry,
}: {
  message: FlueConversationMessage
  isLast: boolean
  busy: boolean
  onReply: (text: string) => Promise<void>
  onRetry?: () => void | Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')

  const copyText = async (value: string) => {
    if (!value.trim()) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1_500)
  }

  if (message.role === 'user') {
    return (
      <Message
        from="user"
        className="message-with-actions max-w-[min(74%,620px)]"
      >
        <div className="message-content-stack">
          <MessageContent className="whitespace-pre-wrap rounded-[20px_20px_5px_20px] px-[17px] py-3 text-[0.93rem] leading-[1.55] group-[.is-user]:text-secondary-foreground">
            {text}
          </MessageContent>
          <MessageCopyAction
            copied={copied}
            onCopy={() => void copyText(text)}
          />
        </div>
      </Message>
    )
  }

  const reasoningText = message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('\n\n')
  const tools = message.parts.filter(
    (part): part is Extract<FlueConversationPart, { type: 'dynamic-tool' }> =>
      part.type === 'dynamic-tool',
  )
  const textStreaming = message.parts.some(
    (part) => part.type === 'text' && part.state === 'streaming',
  )
  const visibleText = textStreaming ? text.split('```beeui')[0] : text
  const { spoken, components } = extractBeeUI(visibleText)
  const hasActivity = Boolean(reasoningText || tools.length)
  const hasResponse = Boolean(spoken || components.length)
  const lastPart = message.parts.at(-1)
  const reasoningStreaming =
    isLast &&
    busy &&
    lastPart?.type === 'reasoning' &&
    lastPart.state === 'streaming'

  if (!hasActivity && !hasResponse) return null

  return (
    <Message
      from="assistant"
      className="max-w-full flex-row items-start gap-[11px]"
    >
      <div className="assistant-mark" aria-hidden="true">
        <img src={beeUrl} alt="" />
      </div>
      <div className="assistant-turn">
        {hasActivity ? (
          <div className="activity-stack">
            {reasoningText ? (
              <Reasoning
                className="mb-0 rounded-xl border border-border bg-card/70 px-3 py-2"
                isStreaming={reasoningStreaming}
              >
                <ReasoningTrigger
                  className="min-h-6 gap-2 text-xs font-semibold"
                  getThinkingMessage={(streaming) =>
                    streaming ? (
                      <Shimmer duration={1}>Bee is reasoning…</Shimmer>
                    ) : (
                      <p>Reasoning</p>
                    )
                  }
                />
                <ReasoningContent className="mt-2 text-xs leading-relaxed">
                  {reasoningText}
                </ReasoningContent>
              </Reasoning>
            ) : null}
            {tools.map((tool) => (
              <ToolActivity key={tool.toolCallId} part={tool} />
            ))}
          </div>
        ) : null}
        {hasResponse ? (
          <div className="assistant-response">
            {spoken ? (
              <MessageResponse className="assistant-markdown">
                {spoken}
              </MessageResponse>
            ) : null}
            <GeneratedUI components={components} onReply={onReply} />
          </div>
        ) : null}
        {hasResponse && !textStreaming ? (
          <div className="message-actions">
            {spoken ? (
              <MessageCopyAction
                copied={copied}
                onCopy={() => void copyText(spoken)}
              />
            ) : null}
            {isLast && !busy && onRetry ? (
              <button
                type="button"
                aria-label="Retry this answer"
                title="Retry answer"
                onClick={() => void onRetry()}
              >
                <RotateCcwIcon aria-hidden="true" />
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Message>
  )
}

function MessageCopyAction({
  copied,
  onCopy,
}: {
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      type="button"
      className="message-copy-action"
      aria-label="Copy message"
      title="Copy message"
      onClick={onCopy}
    >
      {copied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

type ToolActivityPart = Extract<FlueConversationPart, { type: 'dynamic-tool' }>

function ToolActivity({ part }: { part: ToolActivityPart }) {
  const [copied, setCopied] = useState(false)
  const running = part.state === 'input-available'
  const failed = part.state === 'output-error'
  const state = running ? 'running' : failed ? 'error' : 'done'
  const { label, powerup, specialist } = getToolCopy(
    part.toolName,
    state,
    part.input,
  )
  const identity = specialist ?? powerup
  const stateClass = running
    ? 'is-running'
    : failed
      ? 'is-failed'
      : 'is-complete'

  const copyDetails = async () => {
    const result = failed
      ? `Error:\n${part.errorText}`
      : `Result:\n${running ? 'Waiting for the result…' : formatToolValue('output' in part ? part.output : undefined)}`
    await navigator.clipboard.writeText(
      [
        `Tool: ${part.toolName}`,
        `Input:\n${formatToolValue(part.input)}`,
        result,
      ].join('\n\n'),
    )
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }
  return (
    <Tool
      className={`tool-activity-card ${stateClass} mb-0 min-w-0 max-w-full overflow-hidden rounded-xl bg-card/70`}
    >
      <CollapsibleTrigger
        className="tool-activity-trigger group flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-muted-foreground"
        aria-label={`${identity ?? label}: ${running ? 'In progress' : failed ? 'Failed' : 'Completed'}`}
      >
        {running ? <span className="activity-pulse" /> : null}
        {identity ? (
          <strong className="min-w-0 flex-1 text-foreground">{identity}</strong>
        ) : (
          <span className="min-w-0 flex-1">{label}</span>
        )}
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <ToolContent className="min-w-0 space-y-3 overflow-hidden border-t border-border p-3 [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]">
        <ToolInput input={part.input} />
        <ToolOutput
          output={'output' in part ? part.output : undefined}
          errorText={part.errorText}
        />
        <button
          type="button"
          className="tool-copy-action"
          onClick={() => void copyDetails()}
        >
          {copied ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy details'}
        </button>
      </ToolContent>
    </Tool>
  )
}

const plainToolText = z.string()

function formatToolValue(
  value: ToolActivityPart['input'] | ToolActivityPart['output'],
) {
  const text = plainToolText.safeParse(value)
  if (text.success) return text.data
  if (value === undefined) return 'Not available'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ThinkingActivity() {
  return (
    <div className="thinking-row" aria-label="Bee is thinking">
      <div className="assistant-mark" aria-hidden="true">
        <img src={beeUrl} alt="" />
      </div>
      <div className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
