import { useUser } from '@clerk/tanstack-react-start'
import { useEffect, useRef, useState } from 'react'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import { useBeeAgentContext } from './bee-agent-context'
import { AgentMessage, ThinkingActivity } from './message'
import { PromptComposer } from './prompt-composer'
import { useChatThreadActions, useChatThreads } from './use-convex-chat'
import type { ChatThread } from './use-convex-chat'

const HERO_SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
]

export function BeeWorkspace() {
  const agent = useBeeAgentContext()
  const threads = useChatThreads()
  const { activateThread } = useChatThreadActions()
  const { user } = useUser()
  const [railOpen, setRailOpen] = useState(false)
  const hive = agent.currentFirstFocus?.hive
  const highlight = agent.currentFirstFocus?.activeHighlight

  return (
    <main className="workspace-shell">
      <aside className={`conversation-rail${railOpen ? ' is-open' : ''}`}>
        <div className="rail-heading">
          <div>
            <p className="rail-label">Bee</p>
            <strong>Conversations</strong>
          </div>
          <button
            type="button"
            className="icon-button rail-close"
            aria-label="Close conversations"
            onClick={() => setRailOpen(false)}
          >
            ×
          </button>
        </div>

        <button
          type="button"
          className="new-thread-button"
          onClick={() => {
            void agent.resetConversation()
            setRailOpen(false)
          }}
        >
          <span aria-hidden="true">＋</span>
          New conversation
        </button>

        <nav className="thread-nav" aria-label="Conversations">
          <div className="thread-list">
            {[...threads]
              .sort((left, right) => right.createdAt - left.createdAt)
              .map((thread) => (
                <ThreadButton
                  key={thread.id}
                  thread={thread}
                  active={thread.id === agent.thread}
                  onSelect={() => {
                    void activateThread(thread.id)
                    setRailOpen(false)
                  }}
                />
              ))}
          </div>
        </nav>

        <div className="rail-sync-card">
          <span className="sync-dot" aria-hidden="true" />
          <div>
            <strong>Synced across devices</strong>
            <span>Same Convex history and Bee as mobile.</span>
          </div>
        </div>
      </aside>

      {railOpen ? (
        <button
          className="rail-scrim"
          type="button"
          aria-label="Close conversations"
          onClick={() => setRailOpen(false)}
        />
      ) : null}

      <section className="bee-panel">
        <header className="bee-topbar">
          <button
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open conversations"
            onClick={() => setRailOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="bee-topbar__title">
            <span className={`presence-dot${agent.busy ? ' is-busy' : ''}`} />
            <div>
              <strong>Bee</strong>
              <span>{agent.busy ? 'Thinking…' : 'Ready in your Hive'}</span>
            </div>
          </div>
          <div className="hive-balances" aria-label="Hive balances">
            <Balance icon="◇" label="Honey" value={hive?.honeyBalance} />
            <Balance
              icon="⬡"
              label="Honeycomb Score"
              value={hive?.honeycombScore}
            />
            <Balance
              icon="◆"
              label="Royal Jelly"
              value={hive?.royalJellyBalance}
            />
          </div>
        </header>

        {highlight ? (
          <div className="current-highlight">
            <span>Current Highlight</span>
            <strong>{highlight.title}</strong>
          </div>
        ) : null}

        <Conversation agent={agent} firstName={user?.firstName ?? undefined} />
      </section>
    </main>
  )
}

function ThreadButton({
  thread,
  active,
  onSelect,
}: {
  thread: ChatThread
  active: boolean
  onSelect: () => void
}) {
  const title = thread.title?.trim() || 'New focus'
  return (
    <button
      type="button"
      className={`thread-button${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
    >
      <span className="thread-button__comb" aria-hidden="true">
        {title.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <strong>{title}</strong>
        <small>{formatThreadDate(thread.createdAt)}</small>
      </span>
    </button>
  )
}

function formatThreadDate(timestamp: number) {
  if (!timestamp) return 'First conversation'
  const date = new Date(timestamp)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Balance({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: number | undefined
}) {
  return (
    <div className="balance" title={label}>
      <span aria-hidden="true">{icon}</span>
      <strong>{value ?? '–'}</strong>
      <span className="sr-only">{label}</span>
    </div>
  )
}

type BeeAgent = ReturnType<typeof useBeeAgentContext>

function Conversation({
  agent,
  firstName,
}: {
  agent: BeeAgent
  firstName?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const hasConversation = agent.messages.length > 0
  const lastMessage = agent.messages.at(-1)
  const awaitingReply =
    agent.busy &&
    (lastMessage?.role !== 'assistant' ||
      !lastMessage.parts.some(
        (part) =>
          part.type === 'dynamic-tool' ||
          part.type === 'reasoning' ||
          (part.type === 'text' && part.text.length > 0),
      ))

  useEffect(() => {
    if (!following.current) return
    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current
      if (element) element.scrollTop = element.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [agent.messages, awaitingReply])

  return (
    <div className="conversation-area">
      <div
        className={`message-viewport${hasConversation ? '' : ' is-empty'}`}
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 96
        }}
      >
        {hasConversation ? (
          <div className="message-list" aria-live="polite">
            {agent.messages.map((message, index) => (
              <AgentMessage
                key={message.id}
                message={message}
                isLast={index === agent.messages.length - 1}
                busy={agent.busy}
                onReply={agent.sendText}
              />
            ))}
            {awaitingReply ? <ThinkingActivity /> : null}
          </div>
        ) : (
          <EmptyConversation
            firstName={firstName}
            onSuggestion={agent.sendText}
          />
        )}
      </div>

      <div className="composer-dock">
        {agent.errorMessage ? (
          <div className="composer-error" role="alert">
            <span>{agent.errorMessage}</span>
            {agent.speechBlocked ? (
              <button type="button" onClick={() => void agent.replaySpeech()}>
                Play reply
              </button>
            ) : null}
          </div>
        ) : null}
        <PromptComposer onSubmit={agent.sendText} disabled={agent.busy} />
        <p className="composer-note">
          Bee can make mistakes. Confirm important changes before they’re saved.
        </p>
      </div>
    </div>
  )
}

function EmptyConversation({
  firstName,
  onSuggestion,
}: {
  firstName?: string
  onSuggestion: (text: string) => Promise<void>
}) {
  return (
    <div className="conversation-hero">
      <div className="hero-bee-stage" aria-hidden="true">
        <div className="hero-bee-shadow" />
        <img src={beeUrl} alt="" className="hero-bee" />
      </div>
      <div className="conversation-hero__copy">
        <p className="utility-label">Your focus companion</p>
        <h1>
          {firstName
            ? `What matters today, ${firstName}?`
            : 'What matters today?'}
        </h1>
        <p>
          Tell Bee what you want to move forward. Your mobile goals and Hive are
          already here.
        </p>
      </div>
      <div className="suggestion-list" aria-label="Suggestions">
        {HERO_SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => void onSuggestion(suggestion)}
          >
            <span>{suggestion}</span>
            <ArrowIcon />
          </button>
        ))}
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  )
}
