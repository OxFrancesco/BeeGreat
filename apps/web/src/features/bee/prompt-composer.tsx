import { useState } from 'react'

import micIcon from '../../../../mobile/assets/icons/mic-honey.svg?url'
import type { PromptInputMessage } from '~/components/ai-elements/prompt-input'
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '~/components/ai-elements/prompt-input'

const COMMANDS = [
  { command: '/clear', description: 'Clear the conversation and start fresh' },
  { command: '/new', description: 'Start a new conversation' },
] as const

export function PromptComposer({
  onSubmit,
  onTalk,
  recording,
  disabled,
}: {
  onSubmit: (text: string) => Promise<void>
  onTalk: () => void
  recording: boolean
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = Boolean(text.trim()) && !disabled && !submitting
  const typed = text.trim().toLowerCase()
  const matchingCommands = typed.startsWith('/')
    ? COMMANDS.filter((item) => item.command.startsWith(typed))
    : []

  async function send(message: string) {
    if (!message || disabled || submitting) return
    setText('')
    setSubmitting(true)
    try {
      await onSubmit(message)
    } catch {
      setText((current) => current || message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(message: PromptInputMessage) {
    void send(message.text.trim())
  }

  return (
    <div className="prompt-wrap">
      {matchingCommands.length > 0 ? (
        <div className="command-menu">
          {matchingCommands.map((item) => (
            <button
              type="button"
              key={item.command}
              onClick={() => void send(item.command)}
            >
              <strong>{item.command}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <PromptInput className="prompt-composer-shell" onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={text}
            maxLength={4000}
            aria-label="Message Bee"
            placeholder="Ask Bee anything…"
            className="min-h-10 px-4 pt-3 text-[0.92rem] leading-[1.45]"
            onChange={(event) => setText(event.target.value)}
          />
        </PromptInputBody>
        <PromptInputFooter className="prompt-composer-footer">
          <PromptInputButton
            type="button"
            size="sm"
            className={`prompt-talk-button${recording ? ' is-recording' : ''}`}
            aria-label={
              recording ? 'Stop recording and send voice' : 'Talk to Bee'
            }
            aria-pressed={recording}
            disabled={disabled && !recording}
            onClick={onTalk}
          >
            <img src={micIcon} alt="" />
            <span>{recording ? 'Send voice' : 'Talk'}</span>
          </PromptInputButton>
          <PromptInputSubmit
            disabled={!canSubmit}
            status={submitting || disabled ? 'submitted' : 'ready'}
            aria-label={submitting ? 'Sending message' : 'Send message'}
            className="size-9 rounded-full"
            variant="default"
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
