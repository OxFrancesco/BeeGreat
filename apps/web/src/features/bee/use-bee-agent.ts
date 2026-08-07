import { api } from '@beegreat/backend/convex/_generated/api'
import { useAuth } from '@clerk/tanstack-react-start'
import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useVoiceMode } from '../preferences/voice-mode'
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
import { getRetryableTurn } from './retry-turn'
import { useRealtimeVoice } from './use-realtime-voice'
import { captureWebFailure } from '~/lib/sentry'

const BEE_AGENT_NAME = 'bee'

export function useBeeAgent() {
  const { getToken, userId } = useAuth()
  const navigate = useNavigate()
  const voiceMode = useVoiceMode()
  const thread = useActiveChatThread()
  const { createThread, titleThread } = useChatThreadActions()
  const conversationId = userId
    ? thread > 0
      ? `${userId}~${thread}`
      : userId
    : undefined
  // Flue 2.0 clients are conversation-scoped: one client per conversation URL
  // (the agent's mount path plus the conversation id). No id → dormant hook.
  const createClient = useCallback(
    () =>
      conversationId
        ? createFlueClient({
            url: `${AGENT_URL}/agents/${BEE_AGENT_NAME}/${conversationId}`,
            headers: async () => {
              const token = await getToken()
              const headers: Record<string, string> = {}
              if (token) headers.authorization = `Bearer ${token}`
              return headers
            },
          })
        : undefined,
    [conversationId, getToken],
  )
  const [client, setClient] = useState(createClient)
  const agent = useFlueAgent({
    live: BEE_AGENT_LIVE_MODE,
    client,
  })
  const chatHistory = useConvexMessages(thread, agent.messages)
  const currentFirstFocus = useQuery(api.firstFocus.getCurrent, {})
  const completeHighlight = useMutation(api.firstFocus.completeHighlight)
  const hideMessages = useMutation(api.chat.hideMessages)
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

  const retryLastReply = useCallback(async () => {
    if (agent.status === 'submitted' || agent.status === 'streaming') return
    const turn = getRetryableTurn(chatHistory.messages)
    if (!turn) return

    setActionError(undefined)
    try {
      await hideMessages({ threadId: thread, messageIds: turn.messageIds })
      await sendText(turn.text)
    } catch (error) {
      captureWebFailure(error, 'chat.retry')
      setActionError(
        'The retry didn’t go through. Check your connection and try again.',
      )
    }
  }, [agent.status, chatHistory.messages, hideMessages, sendText, thread])

  const busy = agent.status === 'submitted' || agent.status === 'streaming'
  const voice = useBrowserVoice({
    messages: agent.messages,
    historyReady: agent.historyReady,
    status: agent.status,
    conversationId,
    getToken,
    sendText,
  })
  const conversation = useRealtimeVoice(getToken)

  const toggleRecording = useCallback(async () => {
    if (voiceMode === 'conversation') {
      await navigate({ to: '/voice' })
      return
    }
    await voice.toggleRecording()
  }, [navigate, voice.toggleRecording, voiceMode])

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
      recording:
        voiceMode === 'conversation' ? conversation.isActive : voice.recording,
      transcribing: voice.transcribing,
      speaking: voice.speaking,
      speechBlocked: voice.speechBlocked,
      replaySpeech: voice.replaySpeech,
      voiceMode,
      conversation,
      toggleRecording,
      retryLastReply,
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
      retryLastReply,
      sendText,
      thread,
      toggleRecording,
      conversation,
      voiceMode,
      voice.recording,
      voice.replaySpeech,
      voice.speechBlocked,
      voice.speaking,
      voice.transcribing,
      voice.voiceError,
    ],
  )
}
