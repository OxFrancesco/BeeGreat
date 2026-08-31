import { api } from '@beegreat/backend/convex/_generated/api'
import { TranscriptSyncQueue, mergeConvexMessages } from '@beegreat/chat-sync'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo } from 'react'

import type { FlueConversationMessage } from '@flue/sdk'
import { captureWebFailure } from '~/lib/sentry'

const CHAT_HISTORY_PAGE_SIZE = 100

export type ChatThread = {
  id: number
  createdAt: number
  archivedAt?: number
  source?: 'imessage'
  title?: string
}

const DEFAULT_THREAD: ChatThread = { id: 0, createdAt: 0 }

export function useChatThreads() {
  return useQuery(api.chat.listThreads, {}) ?? [DEFAULT_THREAD]
}

export function useActiveChatThread() {
  return useQuery(api.chat.getActiveThread, {}) ?? 0
}

export function useChatThreadActions() {
  const create = useMutation(api.chat.createThread)
  const activate = useMutation(api.chat.setActiveThread)
  const title = useMutation(api.chat.setThreadTitle)
  const archive = useMutation(api.chat.setThreadArchived)

  return {
    createThread: useCallback(() => create({}), [create]),
    activateThread: useCallback(
      (threadId: number) => activate({ threadId }),
      [activate],
    ),
    titleThread: useCallback(
      (threadId: number, nextTitle: string) =>
        title({ threadId, title: nextTitle }),
      [title],
    ),
    setThreadArchived: useCallback(
      (threadId: number, archived: boolean) => archive({ threadId, archived }),
      [archive],
    ),
  }
}

function useTranscriptSync(
  threadId: number,
  flueMessages: Array<FlueConversationMessage>,
) {
  const sync = useMutation(api.chat.syncMessages)
  const queue = useMemo(
    () =>
      new TranscriptSyncQueue(
        (messages) => sync({ threadId, messages }),
        (error) =>
          captureWebFailure(error, 'chat.sync_delta', {
            threadId: String(threadId),
          }),
      ),
    [sync, threadId],
  )

  useEffect(() => {
    queue.activate()
    return () => queue.dispose()
  }, [queue])

  useEffect(() => queue.enqueue(flueMessages), [flueMessages, queue])
}

export function useConvexMessages(
  threadId: number,
  flueMessages: Array<FlueConversationMessage>,
) {
  const history = usePaginatedQuery(
    api.chat.listMessagesPage,
    { threadId },
    { initialNumItems: CHAT_HISTORY_PAGE_SIZE },
  )
  useTranscriptSync(threadId, flueMessages)
  const rows = useMemo(() => [...history.results].reverse(), [history.results])
  const messages = useMemo(
    () => mergeConvexMessages(rows, flueMessages),
    [flueMessages, rows],
  )
  const canLoadOlder = history.status === 'CanLoadMore'
  const loadingOlder = history.status === 'LoadingMore'
  const loadOlder = useCallback(() => {
    if (history.status === 'CanLoadMore') {
      history.loadMore(CHAT_HISTORY_PAGE_SIZE)
    }
  }, [history])

  return { messages, canLoadOlder, loadingOlder, loadOlder }
}
