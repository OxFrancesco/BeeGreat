import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

const COMMANDS = [
  { command: '/clear', description: 'Clear the conversation and start fresh' },
  { command: '/new', description: 'Start a new conversation' },
] as const

export function PromptComposer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => Promise<void>
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = Boolean(text.trim()) && !disabled && !submitting
  const typed = text.trim().toLowerCase()
  const matchingCommands = typed.startsWith('/')
    ? COMMANDS.filter((item) => item.command.startsWith(typed))
    : []

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const message = text.trim()
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

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className="prompt-wrap">
      {matchingCommands.length > 0 ? (
        <div className="command-menu">
          {matchingCommands.map((item) => (
            <button
              type="button"
              key={item.command}
              onClick={() => {
                setText(item.command)
                void submitCommand(item.command)
              }}
            >
              <strong>{item.command}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <form className="prompt-composer" onSubmit={submit}>
        <textarea
          value={text}
          rows={1}
          maxLength={4000}
          aria-label="Message Bee"
          placeholder="Ask Bee anything…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label={submitting ? 'Sending message' : 'Send message'}
        >
          <ArrowUpIcon />
        </button>
      </form>
    </div>
  )

  async function submitCommand(command: string) {
    if (disabled || submitting) return
    setText('')
    setSubmitting(true)
    try {
      await onSubmit(command)
    } catch {
      setText(command)
    } finally {
      setSubmitting(false)
    }
  }
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5M7 10l5-5 5 5" />
    </svg>
  )
}
