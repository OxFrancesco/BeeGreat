import { api } from '@beegreat/backend/convex/_generated/api'
import { useAuth } from '@clerk/tanstack-react-start'
import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  confirmPendingFirstFocus,
  isFirstFocusConfirmation,
  isHighlightCompletion,
} from './first-focus-confirmation'
import {
  useActiveChatThread,
  useChatThreadActions,
  useConvexMessages,
} from './use-convex-chat'
import { useBrowserVoice } from './use-browser-voice'
import { AGENT_URL } from './voice-api'
import {
  beeSendFailureMessage,
  friendlyBeeErrorMessage,
  isAuthHiccup,
} from './agent-error'
import { BEE_AGENT_LIVE_MODE } from './flue-transport'
import { captureWebFailure } from '~/lib/sentry'

const BEE_AGENT_NAME = 'bee'

export function useBeeAgent() {
  const { getToken, userId } = useAuth()
  const thread = useActiveChatThread()
  const { createThread, titleThread } = useChatThreadActions()
  const conversationId = userId
    ? thread > 0
      ? `${userId}~${thread}`
      : userId
    : undefined
  const createClient = useCallback(
    () =>
      createFlueClient({
        baseUrl: AGENT_URL,
        headers: async () => {
          const token = await getToken()
          const headers: Record<string, string> = {}
          if (token) headers.authorization = `Bearer ${token}`
          return headers
        },
      }),
    [getToken],
  )
  const [client, setClient] = useState(createClient)
  const agent = useFlueAgent({
    name: BEE_AGENT_NAME,
    id: conversationId,
    live: BEE_AGENT_LIVE_MODE,
    client,
  })
  const chatHistory = useConvexMessages(thread, agent.messages)
  const currentFirstFocus = useQuery(api.firstFocus.getCurrent, {})
  const completeHighlight = useMutation(api.firstFocus.completeHighlight)
  const syncTimeZone = useMutation(api.user.syncTimeZone)
  const [actionError, setActionError] = useState<string>()
  const stopSpeakingRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    setClient(createClient())
  }, [createClient])

  useEffect(() => {
    if (!isAuthHiccup(agent.error)) return
    const timer = window.setTimeout(() => setClient(createClient()), 1500)
    return () => window.clearTimeout(timer)
  }, [agent.error, createClient])

  useEffect(() => {
    if (!userId) return
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timeZone) {
      void syncTimeZone({ timeZone }).catch((error) => {
        captureWebFailure(error, 'user.sync_time_zone')
      })
    }
  }, [syncTimeZone, userId])

  useEffect(() => {
    const first = agent.messages.find((message) => message.role === 'user')
    if (!first) return
    const title = first.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .slice(0, 64)
    if (title) void titleThread(thread, title)
  }, [agent.messages, thread, titleThread])

  const resetConversation = useCallback(async () => {
    setActionError(undefined)
    stopSpeakingRef.current()
    await createThread()
  }, [createThread])

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text) return
      const command = text.toLowerCase()
      if (command === '/clear' || command === '/new') {
        await resetConversation()
        return
      }

      setActionError(undefined)
      stopSpeakingRef.current()
      if (isFirstFocusConfirmation(text)) {
        const confirmation = await confirmPendingFirstFocus()
        if (confirmation === 'confirmed') {
          await agent.sendMessage(
            '[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again.',
          )
          return
        }
        if (confirmation === 'failed') return
      }

      const activeHighlight = currentFirstFocus?.activeHighlight
      if (isHighlightCompletion(text) && activeHighlight) {
        try {
          const result = await completeHighlight({
            requestId: `complete-highlight:${activeHighlight.highlightId}`,
            taskId: activeHighlight.taskId,
          })
          await agent.sendMessage(
            `[BeeGreat app event] Highlight "${activeHighlight.title}" was completed successfully. The verified award was ${result.honeyAwarded} Honey and ${result.scoreAwarded} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again.`,
          )
          return
        } catch (error) {
          captureWebFailure(error, 'highlight.complete')
          const message =
            error instanceof Error
              ? error.message
              : 'This Highlight could not be completed.'
          setActionError(message)
          throw error
        }
      }

      try {
        await agent.sendMessage(text)
      } catch (error) {
        captureWebFailure(error, 'bee.send_message')
        setActionError(beeSendFailureMessage(error))
        throw error
      }
    },
    [
      agent,
      completeHighlight,
      currentFirstFocus?.activeHighlight,
      resetConversation,
    ],
  )

  const busy = agent.status === 'submitted' || agent.status === 'streaming'
  const voice = useBrowserVoice({
    messages: agent.messages,
    historyReady: agent.historyReady,
    status: agent.status,
    conversationId,
    getToken,
    sendText,
  })

  useEffect(() => {
    stopSpeakingRef.current = voice.stopSpeaking
  }, [voice.stopSpeaking])

  return useMemo(
    () => ({
      ...agent,
      messages: chatHistory.messages,
      canLoadOlder: chatHistory.canLoadOlder,
      loadingOlder: chatHistory.loadingOlder,
      loadOlder: chatHistory.loadOlder,
      busy,
      thread,
      currentFirstFocus,
      errorMessage:
        voice.voiceError ?? actionError ?? friendlyBeeErrorMessage(agent.error),
      recording: voice.recording,
      transcribing: voice.transcribing,
      speaking: voice.speaking,
      speechBlocked: voice.speechBlocked,
      replaySpeech: voice.replaySpeech,
      toggleRecording: voice.toggleRecording,
      resetConversation,
      sendText,
    }),
    [
      actionError,
      agent,
      busy,
      currentFirstFocus,
      chatHistory,
      resetConversation,
      sendText,
      thread,
      voice.recording,
      voice.replaySpeech,
      voice.speechBlocked,
      voice.speaking,
      voice.toggleRecording,
      voice.transcribing,
      voice.voiceError,
    ],
  )
}
