import { useCallback, useEffect, useRef, useState } from 'react'

import {
  XAI_SAMPLE_RATE,
  base64ToBytes,
  bytesToBase64,
  floatToPcm16,
  pcm16ToFloat,
} from './realtime-audio'
import { createRealtimeVoiceToken } from './voice-api'
import { captureWebFailure } from '~/lib/sentry'

const XAI_REALTIME_URL =
  'wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-2.0'
const PLAYBACK_BATCH_BYTES = 24_000
const SESSION_INSTRUCTIONS = `You are Bee, BeeGreat's warm conversational companion.
You are speaking live, so respond naturally and concisely. Keep most turns to a few sentences.
Ask one useful follow-up when it helps. Never read machine identifiers aloud.
You do not have access to the user's BeeGreat goals, tasks, Mind, or account tools in this live mode.
If the user asks you to change or retrieve BeeGreat data, explain briefly that they should use a voice note or typed chat.`

export type RealtimeVoiceStatus =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'

export type RealtimeVoiceTurn = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type XaiEvent = { type?: string; [key: string]: unknown }
type GetToken = () => Promise<string | null>

export function useRealtimeVoice(getToken: GetToken) {
  const socketRef = useRef<WebSocket | null>(null)
  const activeRef = useRef(false)
  const configuredRef = useRef(false)
  const generationRef = useRef(0)
  const responseIdRef = useRef<string | null>(null)
  const responseFinishedRef = useRef(false)
  const responseHasAudioRef = useRef(false)
  const recordingEnabledRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const scheduledSourcesRef = useRef(new Set<AudioBufferSourceNode>())
  const playbackCursorRef = useRef(0)
  const outputChunksRef = useRef<Array<Uint8Array>>([])
  const outputByteLengthRef = useRef(0)
  const connectTimeoutRef = useRef<number | null>(null)
  const [status, setStatus] = useState<RealtimeVoiceStatus>('disconnected')
  const [turns, setTurns] = useState<Array<RealtimeVoiceTurn>>([])
  const [errorMessage, setErrorMessage] = useState<string>()

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current !== null) {
      window.clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }
  }, [])

  const upsertTurn = useCallback(
    (
      id: string,
      role: RealtimeVoiceTurn['role'],
      text: string,
      append = false,
    ) => {
      setTurns((current) => {
        const index = current.findIndex((turn) => turn.id === id)
        if (index < 0) return [...current, { id, role, text }]
        const next = [...current]
        next[index] = {
          ...next[index],
          text: append ? next[index].text + text : text,
        }
        return next
      })
    },
    [],
  )

  const resumeListening = useCallback(() => {
    if (!activeRef.current || !configuredRef.current) return
    recordingEnabledRef.current = true
    responseFinishedRef.current = false
    responseHasAudioRef.current = false
    setStatus('listening')
  }, [])

  const scheduleOutput = useCallback(
    (bytes: Uint8Array) => {
      const context = contextRef.current
      if (!context || !activeRef.current || bytes.byteLength < 2) return
      const samples = pcm16ToFloat(bytes)
      const buffer = context.createBuffer(1, samples.length, XAI_SAMPLE_RATE)
      buffer.copyToChannel(samples, 0)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const startAt = Math.max(
        context.currentTime + 0.025,
        playbackCursorRef.current,
      )
      playbackCursorRef.current = startAt + buffer.duration
      scheduledSourcesRef.current.add(source)
      source.onended = () => {
        scheduledSourcesRef.current.delete(source)
        if (
          activeRef.current &&
          responseFinishedRef.current &&
          scheduledSourcesRef.current.size === 0
        ) {
          resumeListening()
        }
      }
      source.start(startAt)
      responseHasAudioRef.current = true
      setStatus('speaking')
    },
    [resumeListening],
  )

  const flushOutput = useCallback(() => {
    if (outputByteLengthRef.current === 0) return
    const bytes = new Uint8Array(outputByteLengthRef.current)
    let offset = 0
    for (const chunk of outputChunksRef.current) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    outputChunksRef.current = []
    outputByteLengthRef.current = 0
    scheduleOutput(bytes)
  }, [scheduleOutput])

  const cleanupResources = useCallback(() => {
    clearConnectTimeout()
    recordingEnabledRef.current = false
    configuredRef.current = false
    responseIdRef.current = null
    responseFinishedRef.current = false
    responseHasAudioRef.current = false
    outputChunksRef.current = []
    outputByteLengthRef.current = 0
    processorRef.current?.disconnect()
    processorRef.current = null
    inputSourceRef.current?.disconnect()
    inputSourceRef.current = null
    silentGainRef.current?.disconnect()
    silentGainRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    for (const source of scheduledSourcesRef.current) {
      try {
        source.stop()
      } catch {
        // A source that already ended does not need another stop.
      }
    }
    scheduledSourcesRef.current.clear()
    playbackCursorRef.current = 0
    const context = contextRef.current
    contextRef.current = null
    if (context && context.state !== 'closed') void context.close()
  }, [clearConnectTimeout])

  const stop = useCallback(() => {
    activeRef.current = false
    generationRef.current += 1
    const socket = socketRef.current
    socketRef.current = null
    socket?.close(1000, 'Conversation ended')
    cleanupResources()
    setStatus('disconnected')
  }, [cleanupResources])

  const handleEvent = useCallback(
    (event: XaiEvent) => {
      const type = event.type
      if (!type) return
      if (type === 'session.updated') {
        configuredRef.current = true
        recordingEnabledRef.current = true
        clearConnectTimeout()
        setStatus('listening')
        return
      }
      if (type === 'input_audio_buffer.speech_started') {
        setStatus('listening')
        return
      }
      if (type === 'input_audio_buffer.speech_stopped') {
        setStatus('thinking')
        return
      }
      if (
        type === 'conversation.item.input_audio_transcription.updated' ||
        type === 'conversation.item.input_audio_transcription.completed'
      ) {
        const transcript = stringField(event, 'transcript')
        if (transcript) {
          upsertTurn(
            stringField(event, 'item_id') ?? `user-${Date.now()}`,
            'user',
            transcript,
          )
        }
        return
      }
      if (type === 'response.created') {
        const response = objectField(event, 'response')
        const responseId =
          stringField(response, 'id') ?? `assistant-${Date.now()}`
        responseIdRef.current = responseId
        responseFinishedRef.current = false
        responseHasAudioRef.current = false
        recordingEnabledRef.current = false
        outputChunksRef.current = []
        outputByteLengthRef.current = 0
        upsertTurn(responseId, 'assistant', '')
        setStatus('thinking')
        return
      }
      if (
        type === 'response.output_audio_transcript.delta' ||
        type === 'response.audio_transcript.delta'
      ) {
        const delta = stringField(event, 'delta')
        const responseId =
          stringField(event, 'response_id') ?? responseIdRef.current
        if (delta && responseId)
          upsertTurn(responseId, 'assistant', delta, true)
        return
      }
      if (
        type === 'response.output_audio.delta' ||
        type === 'response.audio.delta'
      ) {
        const delta = stringField(event, 'delta')
        if (!delta) return
        const bytes = base64ToBytes(delta)
        outputChunksRef.current.push(bytes)
        outputByteLengthRef.current += bytes.byteLength
        if (outputByteLengthRef.current >= PLAYBACK_BATCH_BYTES) flushOutput()
        setStatus('speaking')
        return
      }
      if (
        type === 'response.output_audio.done' ||
        type === 'response.audio.done'
      ) {
        flushOutput()
        return
      }
      if (type === 'response.done') {
        responseIdRef.current = null
        responseFinishedRef.current = true
        flushOutput()
        if (
          !responseHasAudioRef.current &&
          scheduledSourcesRef.current.size === 0
        ) {
          resumeListening()
        }
        return
      }
      if (type === 'ping') {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'pong',
              ping_timestamp: event.ping_timestamp,
            }),
          )
        }
        return
      }
      if (type === 'error') {
        const message =
          stringField(event, 'message') ||
          stringField(objectField(event, 'error'), 'message') ||
          'The live voice session hit a problem.'
        setErrorMessage(message)
        setStatus('error')
      }
    },
    [clearConnectTimeout, flushOutput, resumeListening, upsertTurn],
  )

  const start = useCallback(async () => {
    if (activeRef.current) return
    if (
      !Reflect.has(navigator, 'mediaDevices') ||
      !Reflect.has(window, 'AudioContext')
    ) {
      setErrorMessage('This browser does not support live microphone audio.')
      setStatus('error')
      return
    }
    const generation = generationRef.current + 1
    generationRef.current = generation
    activeRef.current = true
    setTurns([])
    setErrorMessage(undefined)
    setStatus('connecting')

    try {
      const [stream, { token }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
        createRealtimeVoiceToken(getToken),
      ])
      const sessionIsCurrent = () =>
        activeRef.current && generationRef.current === generation
      if (!sessionIsCurrent()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const context = new AudioContext()
      await context.resume()
      contextRef.current = context
      streamRef.current = stream
      const inputSource = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const silentGain = context.createGain()
      silentGain.gain.value = 0
      inputSource.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(context.destination)
      inputSourceRef.current = inputSource
      processorRef.current = processor
      silentGainRef.current = silentGain
      processor.onaudioprocess = (event) => {
        if (!recordingEnabledRef.current || !configuredRef.current) return
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        const pcm = floatToPcm16(
          event.inputBuffer.getChannelData(0),
          context.sampleRate,
        )
        socket.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: bytesToBase64(pcm),
          }),
        )
      }

      const socket = new WebSocket(XAI_REALTIME_URL, [
        `xai-client-secret.${token}`,
      ])
      socketRef.current = socket
      socket.onopen = () => {
        if (!activeRef.current) return socket.close(1000, 'Conversation ended')
        socket.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              instructions: SESSION_INSTRUCTIONS,
              voice: 'eve',
              reasoning: { effort: 'high' },
              turn_detection: {
                type: 'server_vad',
                silence_duration_ms: 650,
                prefix_padding_ms: 333,
              },
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: XAI_SAMPLE_RATE },
                  transcription: { model: 'grok-transcribe' },
                },
                output: {
                  format: { type: 'audio/pcm', rate: XAI_SAMPLE_RATE },
                },
              },
            },
          }),
        )
      }
      socket.onmessage = ({ data }) => {
        if (typeof data !== 'string') return
        try {
          handleEvent(JSON.parse(data) as XaiEvent)
        } catch (cause) {
          captureWebFailure(cause, 'voice.xai.event')
        }
      }
      socket.onerror = () => {
        if (activeRef.current) {
          setErrorMessage('Bee could not connect to conversational voice.')
          setStatus('error')
        }
      }
      socket.onclose = ({ code }) => {
        if (!activeRef.current) return
        activeRef.current = false
        cleanupResources()
        setErrorMessage(`The live voice session ended (${code}).`)
        setStatus('error')
      }
      connectTimeoutRef.current = window.setTimeout(() => {
        if (configuredRef.current || !activeRef.current) return
        activeRef.current = false
        socket.close()
        cleanupResources()
        setErrorMessage('Conversational voice took too long to connect.')
        setStatus('error')
      }, 10_000)
    } catch (cause) {
      activeRef.current = false
      cleanupResources()
      captureWebFailure(cause, 'voice.xai.start')
      setErrorMessage(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Microphone access is off. Allow it in your browser to talk live.'
          : cause instanceof Error
            ? cause.message
            : 'Conversational voice could not start.',
      )
      setStatus('error')
    }
  }, [cleanupResources, getToken, handleEvent])

  useEffect(() => () => stop(), [stop])

  return {
    status,
    turns,
    errorMessage,
    isActive:
      status === 'connecting' ||
      status === 'listening' ||
      status === 'thinking' ||
      status === 'speaking',
    start,
    stop,
  }
}

function objectField(value: Record<string, unknown>, key: string) {
  const candidate = value[key]
  return candidate && typeof candidate === 'object'
    ? (candidate as Record<string, unknown>)
    : {}
}

function stringField(value: Record<string, unknown>, key: string) {
  const candidate = value[key]
  return typeof candidate === 'string' ? candidate : undefined
}
