import { useUser } from '@clerk/tanstack-react-start'
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStickToBottomContext } from 'use-stick-to-bottom'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import { useBeeAgentContext } from './bee-agent-context'
import { AgentMessage, ThinkingActivity } from './message'
import { PromptComposer } from './prompt-composer'
import { useChatThreadActions, useChatThreads } from './use-convex-chat'
import type { ChatThread } from './use-convex-chat'
import { Suggestion, Suggestions } from '~/components/ai-elements/suggestion'
import {
  ConversationContent,
  ConversationScrollButton,
  Conversation as ConversationViewport,
} from '~/components/ai-elements/conversation'

const HERO_SUGGESTIONS = [
  'What should I focus on today?',
  'Show my goals',
  'What tasks are still open?',
]

export function BeeWorkspace() {
  const agent = useBeeAgentContext()
  const threads = useChatThreads()
  const { activateThread, setThreadArchived } = useChatThreadActions()
  const { user } = useUser()
  const [railOpen, setRailOpen] = useState(true)
  const [compactShell, setCompactShell] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const historyButtonRef = useRef<HTMLButtonElement>(null)
  const hive = agent.currentFirstFocus?.hive
  const highlight = agent.currentFirstFocus?.activeHighlight
  const sortedThreads = [...threads].sort(
    (left, right) => right.createdAt - left.createdAt,
  )
  const currentThreads = sortedThreads.filter((thread) => !thread.archivedAt)
  const archivedThreads = sortedThreads.filter((thread) => thread.archivedAt)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1120px)')
    const update = () => {
      setCompactShell(media.matches)
      // The rail overlays content on compact shells, so it starts closed
      // there and open on desktop.
      setRailOpen(!media.matches)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!compactShell || !railOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRail()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
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
    <main
      className={`workspace-shell${railOpen || compactShell ? '' : ' is-rail-closed'}`}
    >
      <aside
        id="conversation-history"
        className={`conversation-rail${railOpen ? ' is-open' : ''}`}
        aria-label="Conversation history"
        aria-hidden={!railOpen}
        inert={!railOpen}
      >
        <div className="rail-heading">
          <strong>Conversations</strong>
          <button
            type="button"
            className="icon-button rail-heading__toggle"
            aria-label="Hide conversations"
            aria-controls="conversation-history"
            aria-expanded={railOpen}
            onClick={closeRail}
          >
            <ChevronLeftIcon aria-hidden="true" />
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
            {currentThreads.map((thread) => (
              <ThreadButton
                key={thread.id}
                thread={thread}
                active={thread.id === agent.thread}
                onSelect={() => {
                  void activateThread(thread.id)
                  closeRail()
                }}
                onArchive={() => void setThreadArchived(thread.id, true)}
              />
            ))}
            {archivedThreads.length > 0 ? (
              <div className="archived-threads">
                <button
                  type="button"
                  className="archived-threads__toggle"
                  aria-expanded={showArchived}
                  onClick={() => setShowArchived((visible) => !visible)}
                >
                  <ArchiveIcon aria-hidden="true" />
                  Archived ({archivedThreads.length})
                  <ChevronDownIcon aria-hidden="true" />
                </button>
                {showArchived
                  ? archivedThreads.map((thread) => (
                      <ThreadButton
                        key={thread.id}
                        thread={thread}
                        active={thread.id === agent.thread}
                        onSelect={() => {
                          void activateThread(thread.id)
                          closeRail()
                        }}
                        onArchive={() =>
                          void setThreadArchived(thread.id, false)
                        }
                      />
                    ))
                  : null}
              </div>
            ) : null}
          </div>
        </nav>
      </aside>

      {compactShell && railOpen ? (
        <button
          className="rail-scrim"
          type="button"
          aria-label="Close conversations"
          onClick={closeRail}
        />
      ) : null}

      <section className="bee-panel">
        {!railOpen ? (
          <button
            ref={historyButtonRef}
            className="icon-button rail-reopen"
            type="button"
            aria-label="Show conversations"
            aria-controls="conversation-history"
            aria-expanded={false}
            onClick={openRail}
          >
            <ChevronRightIcon aria-hidden="true" />
          </button>
        ) : null}

        <div className="bee-resources">
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
        </div>

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
  onArchive,
}: {
  thread: ChatThread
  active: boolean
  onSelect: () => void
  onArchive: () => void
}) {
  const title = thread.title?.trim() || 'New focus'
  return (
    <div className={`thread-row${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="thread-button"
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
      >
        <span>
          <strong>{title}</strong>
          <small>
            {thread.source === 'imessage' ? 'iMessage · ' : ''}
            {formatThreadDate(thread.createdAt)}
          </small>
        </span>
      </button>
      <button
        type="button"
        className="thread-archive-button"
        aria-label={`${thread.archivedAt ? 'Unarchive' : 'Archive'} ${title}`}
        title={thread.archivedAt ? 'Unarchive' : 'Archive'}
        onClick={onArchive}
      >
        {thread.archivedAt ? (
          <RotateCcwIcon aria-hidden="true" />
        ) : (
          <ArchiveIcon aria-hidden="true" />
        )}
      </button>
    </div>
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
  const [sendSignal, setSendSignal] = useState(0)
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
    setSendSignal((count) => count + 1)
    await agent.sendText(text)
  }

  return (
    <div className="conversation-area">
      {hasConversation ? (
        <ConversationViewport>
          <ConversationContent className="message-list" aria-live="polite">
            <FollowLiveEdge signal={sendSignal} />
            {agent.canLoadOlder || agent.loadingOlder ? (
              <button
                className="button button--quiet load-earlier-messages"
                type="button"
                disabled={agent.loadingOlder}
                onClick={agent.loadOlder}
              >
                {agent.loadingOlder
                  ? 'Loading earlier messages…'
                  : 'Load earlier messages'}
              </button>
            ) : null}
            {agent.messages.map((message, index) => (
              <AgentMessage
                key={message.id}
                message={message}
                isLast={index === agent.messages.length - 1}
                busy={agent.busy}
                onReply={sendAndFollow}
                onRetry={agent.retryLastReply}
              />
            ))}
            {awaitingReply ? <ThinkingActivity /> : null}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest message" />
        </ConversationViewport>
      ) : (
        <div className="message-viewport is-empty">
          <EmptyConversation
            firstName={firstName}
            onSuggestion={sendAndFollow}
          />
        </div>
      )}

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
        <PromptComposer
          onSubmit={sendAndFollow}
          onTalk={() => void agent.toggleRecording()}
          recording={agent.recording}
          disabled={agent.busy}
        />
      </div>
    </div>
  )
}

/**
 * StickToBottom only follows passive updates when the reader is already at
 * the live edge. Sending a message is an explicit request to return there.
 */
function FollowLiveEdge({ signal }: { signal: number }) {
  const { scrollToBottom } = useStickToBottomContext()
  const seen = useRef(signal)

  useEffect(() => {
    if (signal === seen.current) return
    seen.current = signal
    void scrollToBottom()
  }, [signal, scrollToBottom])

  return null
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
      <Suggestions
        className="mt-[30px] flex-wrap justify-center"
        aria-label="Suggestions"
      >
        {HERO_SUGGESTIONS.map((suggestion) => (
          <Suggestion
            key={suggestion}
            suggestion={suggestion}
            className="border-border bg-card font-medium text-muted-foreground hover:border-primary/45 hover:text-foreground"
            onClick={(text) => void onSuggestion(text)}
          />
        ))}
      </Suggestions>
    </div>
  )
}
