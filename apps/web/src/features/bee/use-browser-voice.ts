import { useCallback, useEffect, useRef, useState } from 'react'

import { useSpeakReplies } from '../preferences/speak-replies'
import { extractBeeUI } from './bee-ui'
import { synthesizeSpeech, transcribeBlob } from './voice-api'
import type { FlueConversationMessage } from '@flue/sdk'
import { captureWebFailure } from '~/lib/sentry'

type GetToken = () => Promise<string | null>

function supportedRecordingType() {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
}

export function useBrowserVoice({
  messages,
  historyReady,
  status,
  conversationId,
  getToken,
  sendText,
}: {
  messages: Array<FlueConversationMessage>
  historyReady: boolean
  status: string
  conversationId: string | undefined
  getToken: GetToken
  sendText: (text: string) => Promise<void>
}) {
  const speakReplies = useSpeakReplies()
  const recorderRef = useRef<MediaRecorder | undefined>(undefined)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const chunksRef = useRef<Array<Blob>>([])
  const audioRef = useRef<HTMLAudioElement | undefined>(undefined)
  const speechErrorRef = useRef(false)
  const spokenIds = useRef(new Set<string>())
  const seededHistory = useRef(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speechBlocked, setSpeechBlocked] = useState(false)
  const [voiceError, setVoiceError] = useState<string>()

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = undefined
    setSpeaking(false)
    setSpeechBlocked(false)
    if (speechErrorRef.current) {
      speechErrorRef.current = false
      setVoiceError(undefined)
    }
  }, [])

  const showSpeechError = useCallback((message: string) => {
    speechErrorRef.current = true
    setVoiceError(message)
  }, [])

  const replaySpeech = useCallback(async () => {
    const player = audioRef.current
    if (!player) return
    speechErrorRef.current = false
    setVoiceError(undefined)
    setSpeechBlocked(false)
    setSpeaking(true)
    player.currentTime = 0
    try {
      await player.play()
    } catch {
      setSpeaking(false)
      setSpeechBlocked(true)
      showSpeechError(
        'Your browser paused Bee’s reply. Tap Play reply to hear it.',
      )
    }
  }, [showSpeechError])

  useEffect(() => {
    spokenIds.current.clear()
    seededHistory.current = false
  }, [conversationId])

  useEffect(() => {
    if (!historyReady || seededHistory.current) return
    seededHistory.current = true
    messages.forEach((message) => spokenIds.current.add(message.id))
  }, [historyReady, messages])

  useEffect(() => {
    if (!seededHistory.current || status !== 'idle') return
    const latest = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant')
    if (!latest || spokenIds.current.has(latest.id)) return
    if (
      latest.parts.some(
        (part) => part.type === 'text' && part.state === 'streaming',
      )
    ) {
      return
    }
    spokenIds.current.add(latest.id)
    if (!speakReplies) return
    const rawText = latest.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
    const { spoken } = extractBeeUI(rawText)
    if (!spoken) return

    let cancelled = false
    if (speechErrorRef.current) setVoiceError(undefined)
    speechErrorRef.current = false
    setSpeechBlocked(false)
    void synthesizeSpeech(spoken, getToken)
      .then(({ audio, mimeType = 'audio/mpeg' }) => {
        if (cancelled) return
        stopSpeaking()
        const player = new Audio(`data:${mimeType};base64,${audio}`)
        audioRef.current = player
        player.onended = () => setSpeaking(false)
        player.onerror = () => {
          setSpeaking(false)
          setSpeechBlocked(false)
          showSpeechError('Bee’s spoken reply could not be played.')
        }
        setSpeaking(true)
        return player.play().catch(() => {
          setSpeaking(false)
          setSpeechBlocked(true)
          showSpeechError(
            'Your browser paused Bee’s reply. Tap Play reply to hear it.',
          )
        })
      })
      .catch((error) => {
        captureWebFailure(error, 'voice.synthesize')
        setSpeaking(false)
        showSpeechError('Bee’s spoken reply could not be prepared.')
      })
    return () => {
      cancelled = true
    }
  }, [getToken, messages, showSpeechError, speakReplies, status, stopSpeaking])

  useEffect(() => {
    if (!speakReplies) stopSpeaking()
  }, [speakReplies, stopSpeaking])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = undefined
  }, [])

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      stopTracks()
      audioRef.current?.pause()
    },
    [stopTracks],
  )

  const toggleRecording = useCallback(async () => {
    speechErrorRef.current = false
    setVoiceError(undefined)
    const activeRecorder = recorderRef.current
    if (activeRecorder?.state === 'recording') {
      activeRecorder.stop()
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setVoiceError('This browser does not support microphone recording.')
      return
    }

    try {
      stopSpeaking()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = supportedRecordingType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        setRecording(false)
        stopTracks()
        setTranscribing(true)
        void transcribeBlob(blob, getToken)
          .then((transcript) => {
            if (!transcript) {
              setVoiceError('I didn’t catch that. Try again.')
              return
            }
            return sendText(transcript)
          })
          .catch((cause) => {
            captureWebFailure(cause, 'voice.transcribe')
            setVoiceError(
              cause instanceof Error ? cause.message : 'Transcription failed.',
            )
          })
          .finally(() => setTranscribing(false))
      }
      recorder.start()
      setRecording(true)
    } catch (cause) {
      captureWebFailure(cause, 'voice.start_recording')
      stopTracks()
      setRecording(false)
      setVoiceError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Microphone access is off. Allow it in your browser to talk to Bee.'
          : cause instanceof Error
            ? cause.message
            : 'The microphone could not start.',
      )
    }
  }, [getToken, sendText, stopSpeaking, stopTracks])

  return {
    recording,
    transcribing,
    speaking,
    speechBlocked,
    voiceError,
    stopSpeaking,
    replaySpeech,
    toggleRecording,
  }
}
