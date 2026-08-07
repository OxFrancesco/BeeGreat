import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useBeeAgentContext } from './bee-agent-context'

const STATUS_COPY = {
  disconnected: 'Ready for a live conversation',
  connecting: 'Connecting to Grok Voice…',
  listening: 'Listening — just speak',
  thinking: 'Thinking…',
  speaking: 'Bee is speaking',
  error: 'Conversation paused',
} as const

export function RealtimeVoicePage() {
  const { conversation } = useBeeAgentContext()
  const navigate = useNavigate()

  useEffect(() => {
    void conversation.start()
    return conversation.stop
  }, [conversation.start, conversation.stop])

  const endConversation = () => {
    conversation.stop()
    void navigate({ to: '/bee' })
  }

  return (
    <main className="realtime-voice-page">
      <section className="realtime-voice-card">
        <div className="voice-orb-stage">
          <button
            type="button"
            className={`voice-orb voice-orb--${conversation.status}`}
            aria-label={
              conversation.isActive
                ? 'End live conversation'
                : 'Start live conversation'
            }
            onClick={
              conversation.isActive
                ? endConversation
                : () => void conversation.start()
            }
          >
            <span className="voice-orb__core" />
            <span className="voice-orb__ring" />
          </button>
          <div className="voice-live-status" aria-live="polite">
            <span
              className={conversation.status === 'error' ? 'is-error' : ''}
              aria-hidden="true"
            />
            <strong>{STATUS_COPY[conversation.status]}</strong>
          </div>
          <p>
            Live speech-to-speech with Grok Think Fast 2.0. This mode is for
            conversation; use Voice note when Bee needs your goals, tasks, or
            tools.
          </p>
        </div>

        {conversation.turns.length > 0 ? (
          <div className="voice-timeline" aria-live="polite">
            {conversation.turns.map((turn) => (
              <article
                key={turn.id}
                className={`voice-turn voice-turn--${turn.role}`}
              >
                <strong>
                  {turn.role === 'user' ? 'You' : 'Bee · Grok Voice'}
                </strong>
                <p>{turn.text || '…'}</p>
              </article>
            ))}
          </div>
        ) : null}

        {conversation.errorMessage ? (
          <p className="inline-error voice-conversation-error" role="alert">
            {conversation.errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          className={`voice-conversation-action${conversation.isActive ? ' is-active' : ''}`}
          onClick={
            conversation.isActive
              ? endConversation
              : () => void conversation.start()
          }
        >
          {conversation.isActive ? 'End conversation' : 'Try again'}
        </button>
      </section>
    </main>
  )
}
