import { useUser } from '@clerk/tanstack-react-start'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import historyIcon from '../../../../mobile/assets/icons/honeycomb.svg?url'
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
  const [compactShell, setCompactShell] = useState(false)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const hive = agent.currentFirstFocus?.hive
  const highlight = agent.currentFirstFocus?.activeHighlight

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1120px)')
    const update = () => setCompactShell(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!compactShell || !railOpen) return
    const frame = window.requestAnimationFrame(() =>
      closeButtonRef.current?.focus(),
    )
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRail()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [compactShell, railOpen])

  function openRail() {
    setRailOpen(true)
  }

  function closeRail() {
    setRailOpen(false)
    if (compactShell) {
      window.requestAnimationFrame(() => historyButtonRef.current?.focus())
    }
  }

  return (
    <main className="workspace-shell">
      <aside
        id="conversation-history"
        className={`conversation-rail${railOpen ? ' is-open' : ''}`}
        aria-label="Conversation history"
        aria-hidden={compactShell && !railOpen}
        inert={compactShell && !railOpen}
      >
        <div className="rail-heading">
          <div>
            <p className="rail-label">Bee</p>
            <strong>Conversations</strong>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button rail-close"
            aria-label="Close conversations"
            onClick={closeRail}
          >
            ×
          </button>
        </div>

        <button
          type="button"
          className="new-thread-button"
          onClick={() => {
            void agent.resetConversation()
            closeRail()
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
                    closeRail()
                  }}
                />
              ))}
          </div>
        </nav>
      </aside>

      {railOpen ? (
        <button
          className="rail-scrim"
          type="button"
          aria-label="Close conversations"
          onClick={closeRail}
        />
      ) : null}

      <section className="bee-panel">
        <header className="bee-topbar">
          <button
            ref={historyButtonRef}
            className="icon-button mobile-menu"
            type="button"
            aria-label="Open conversations"
            aria-controls="conversation-history"
            aria-expanded={compactShell ? railOpen : true}
            onClick={openRail}
          >
            <img src={historyIcon} alt="" />
          </button>
          <div className="bee-topbar__title">
            <span className={`presence-dot${agent.busy ? ' is-busy' : ''}`} />
            <div>
              <strong>Bee</strong>
              <span>{agent.busy ? 'Thinking…' : 'Ready in your Hive'}</span>
            </div>
          </div>
          <div className="hive-balances" aria-label="Hive balances">
            <Balance kind="honey" label="Honey" value={hive?.honeyBalance} />
            <Balance
              kind="score"
              label="Honeycomb Score"
              value={hive?.honeycombScore}
            />
            <Balance
              kind="jelly"
              label="Royal Jelly"
              value={hive?.royalJellyBalance}
            />
          </div>
          <Link
            className="bee-profile"
            to="/settings"
            aria-label="Open profile and settings"
          >
            {user?.hasImage ? (
              <img src={user.imageUrl} alt="" />
            ) : (
              <span aria-hidden="true">
                {(user?.firstName ?? 'B').slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        </header>

        {highlight ? (
          <div className="current-highlight">
            <span>Current Highlight</span>
            <strong>{highlight.title}</strong>
          </div>
        ) : null}

        <Conversation
          key={`thread:${agent.thread}`}
          agent={agent}
          firstName={user?.firstName ?? undefined}
        />
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
  kind,
  label,
  value,
}: {
  kind: 'honey' | 'score' | 'jelly'
  label: string
  value: number | undefined
}) {
  return (
    <div className="balance" title={label}>
      <span
        className={`currency-icon currency-icon--${kind}`}
        aria-hidden="true"
      />
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

  const sendAndFollow = async (text: string) => {
    // Sending is an explicit request to return to the live edge. Passive
    // incoming updates still respect a reader who has scrolled into history.
    following.current = true
    await agent.sendText(text)
  }

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
            {agent.canLoadOlder || agent.loadingOlder ? (
              <button
                className="button button--quiet load-earlier-messages"
                type="button"
                disabled={agent.loadingOlder}
                onClick={agent.loadOlder}
              >
                {agent.loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
              </button>
            ) : null}
            {agent.messages.map((message, index) => (
              <AgentMessage
                key={message.id}
                message={message}
                isLast={index === agent.messages.length - 1}
                busy={agent.busy}
                onReply={sendAndFollow}
              />
            ))}
            {awaitingReply ? <ThinkingActivity /> : null}
          </div>
        ) : (
          <EmptyConversation
            firstName={firstName}
            onSuggestion={sendAndFollow}
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
        <PromptComposer onSubmit={sendAndFollow} disabled={agent.busy} />
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
        <h1>
          {firstName
            ? `What matters today, ${firstName}?`
            : 'What matters today?'}
        </h1>
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

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  )
}
