import { extractBeeUI } from './bee-ui'
import { GeneratedUI } from './generated-ui'
import { getToolCopy } from './tool-labels'
import type { FlueConversationMessage, FlueConversationPart } from '@flue/react'

export function AgentMessage({
  message,
  isLast,
  busy,
  onReply,
}: {
  message: FlueConversationMessage
  isLast: boolean
  busy: boolean
  onReply: (text: string) => Promise<void>
}) {
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')

  if (message.role === 'user') {
    return (
      <article className="message-row message-row--user">
        <div className="message-bubble message-bubble--user">{text}</div>
      </article>
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
    <article className="message-row message-row--assistant">
      <div className="assistant-mark" aria-hidden="true">
        <img src="/logo.png" alt="" />
      </div>
      <div className="assistant-turn">
        {hasActivity ? (
          <div className="activity-stack">
            {reasoningText ? (
              <details className="reasoning" open={reasoningStreaming}>
                <summary>
                  <span
                    className={reasoningStreaming ? 'activity-pulse' : ''}
                  />
                  {reasoningStreaming ? 'Bee is reasoning' : 'Reasoning'}
                </summary>
                <p>{reasoningText}</p>
              </details>
            ) : null}
            {tools.map((tool) => (
              <ToolActivity key={tool.toolCallId} part={tool} />
            ))}
          </div>
        ) : null}
        {hasResponse ? (
          <div className="assistant-response">
            {spoken ? <p>{spoken}</p> : null}
            <GeneratedUI components={components} onReply={onReply} />
          </div>
        ) : null}
      </div>
    </article>
  )
}

function ToolActivity({
  part,
}: {
  part: Extract<FlueConversationPart, { type: 'dynamic-tool' }>
}) {
  const running = part.state === 'input-available'
  const failed = part.state === 'output-error'
  const state = running ? 'running' : failed ? 'error' : 'done'
  const { label, powerup } = getToolCopy(part.toolName, state, part.input)
  const powerupClass = powerup
    ? ` is-powerup is-${powerup.toLowerCase().replace(/\s+/g, '-')}`
    : ''
  return (
    <details
      className={`tool-activity${failed ? ' is-error' : ''}${powerupClass}`}
    >
      <summary>
        <span className={running ? 'activity-pulse' : ''} />
        {powerup ? (
          <span className="tool-powerup">
            <strong>{powerup}</strong>
            <small>{label}</small>
          </span>
        ) : (
          label
        )}
        {powerup ? <em>Power-up</em> : null}
        {!running ? (
          <span className="tool-status">{failed ? '!' : '✓'}</span>
        ) : null}
      </summary>
      <pre>
        {JSON.stringify(
          failed
            ? { input: part.input, error: part.errorText }
            : 'output' in part
              ? { input: part.input, output: part.output }
              : { input: part.input },
          null,
          2,
        )}
      </pre>
    </details>
  )
}

export function ThinkingActivity() {
  return (
    <div className="thinking-row" aria-label="Bee is thinking">
      <div className="assistant-mark" aria-hidden="true">
        <img src="/logo.png" alt="" />
      </div>
      <div className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
