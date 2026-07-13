import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

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
  )
}

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 19V5M7 10l5-5 5 5" />
    </svg>
  )
}
