import { enqueueAudioOperation } from '@/lib/audio-operation-queue';
import {
  AudioModule,
  setAudioModeAsync,
  useAudioPlaylist,
  useAudioPlaylistStatus,
  useAudioStream,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import type { OrbState } from '@/components/agent/voice-orb';
import { captureMobileFailure } from '@/lib/sentry';
import { createRealtimeVoiceToken } from '@/lib/voice-api';
import {
  arrayBufferToBase64,
  base64ToBytes,
  concatBytes,
  pcm16ToWav,
} from '@/lib/xai-audio';

const OUTPUT_SAMPLE_RATE = 24_000;
const PLAYBACK_BATCH_BYTES = 24_000;
const SESSION_INSTRUCTIONS = `You are Bee, BeeGreat's warm conversational companion.
You are speaking live, so respond naturally and concisely. Keep most turns to a few sentences.
Ask one useful follow-up when it helps. Never read machine identifiers aloud.
You do not have access to the user's BeeGreat goals, tasks, Mind, or account tools in this live mode.
If the user asks you to change or retrieve BeeGreat data, explain briefly that they should use a voice note or typed chat.`;

export type RealtimeVoiceStatus =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export type RealtimeVoiceTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

// Field-tolerant realtime event decoding: a malformed field reads as absent,
// matching how unknown event types are ignored.
const tolerantString = z.string().optional().catch(undefined);

const xaiEventSchema = z.object({
  type: tolerantString,
  item_id: tolerantString,
  transcript: tolerantString,
  delta: tolerantString,
  response_id: tolerantString,
  message: tolerantString,
  ping_timestamp: z.union([z.number(), z.string()]).optional().catch(undefined),
  response: z.object({ id: tolerantString }).optional().catch(undefined),
  error: z.object({ message: tolerantString }).optional().catch(undefined),
});

type XaiEvent = z.infer<typeof xaiEventSchema>;

export function useXaiVoiceConversation() {
  const webSocketRef = useRef<WebSocket | null>(null);
  const activeRef = useRef(false);
  const generationRef = useRef(0);
  const configuredRef = useRef(false);
  const responseIdRef = useRef<string | null>(null);
  const outputChunksRef = useRef<Uint8Array[]>([]);
  const outputByteLengthRef = useRef(0);
  const outputFileCounterRef = useRef(0);
  const outputFilesRef = useRef<File[]>([]);
  const responseHasAudioRef = useRef(false);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] =
    useState<RealtimeVoiceStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [turns, setTurns] = useState<RealtimeVoiceTurn[]>([]);
  const [responseFinished, setResponseFinished] = useState(false);

  const playlist = useAudioPlaylist({ updateInterval: 100 });
  const playlistStatus = useAudioPlaylistStatus(playlist);

  const sendAudioBuffer = useCallback((buffer: ArrayBuffer) => {
    const socket = webSocketRef.current;
    if (
      !configuredRef.current ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: arrayBufferToBase64(buffer),
      }),
    );
  }, []);

  const { stream } = useAudioStream({
    sampleRate: OUTPUT_SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: ({ data }) => sendAudioBuffer(data),
  });

  const stopStream = useCallback(() => {
    try {
      stream.stop();
    } catch {
      // Fast Refresh can invalidate Expo's native shared object before React
      // runs this hook's cleanup. The stream is already gone in that case.
    }
  }, [stream]);

  const clearConnectTimeout = useCallback(() => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
  }, []);

  const deleteOutputFiles = useCallback(() => {
    for (const file of outputFilesRef.current) {
      try {
        if (file.exists) file.delete();
      } catch {
        // Cache cleanup is best-effort.
      }
    }
    outputFilesRef.current = [];
  }, []);

  const clearPlayback = useCallback(() => {
    try { playlist.pause(); playlist.clear(); } catch { /* Native teardown may have released the playlist already. */ }
    outputChunksRef.current = [];
    outputByteLengthRef.current = 0;
    responseHasAudioRef.current = false;
    deleteOutputFiles();
  }, [deleteOutputFiles, playlist]);

  const queueOutputAudio = useCallback(() => {
    if (outputByteLengthRef.current === 0) return;
    const pcm = concatBytes(outputChunksRef.current);
    outputChunksRef.current = [];
    outputByteLengthRef.current = 0;

    const file = new File(
      Paths.cache,
      `bee-grok-${Date.now()}-${outputFileCounterRef.current++}.wav`,
    );
    file.create();
    file.write(pcm16ToWav(pcm, OUTPUT_SAMPLE_RATE));
    outputFilesRef.current.push(file);
    responseHasAudioRef.current = true;
    playlist.add(file.uri);
    playlist.play();
  }, [playlist]);

  const upsertTurn = useCallback(
    (
      id: string,
      role: RealtimeVoiceTurn['role'],
      text: string,
      append = false,
    ) => {
      setTurns((current) => {
        const index = current.findIndex((turn) => turn.id === id);
        if (index === -1) return [...current, { id, role, text }];
        const next = [...current];
        next[index] = {
          ...next[index],
          text: append ? next[index].text + text : text,
        };
        return next;
      });
    },
    [],
  );

  const stop = useCallback(() => {
    const wasActive = activeRef.current;
    activeRef.current = false;
    generationRef.current += 1;
    configuredRef.current = false;
    responseIdRef.current = null;
    clearConnectTimeout();
    stopStream();
    const socket = webSocketRef.current;
    webSocketRef.current = null;
    socket?.close(1000, 'Conversation ended');
    clearPlayback();
    setResponseFinished(false);
    setStatus('disconnected');
    if (wasActive) void enqueueAudioOperation(() => setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    })).catch(cause => captureMobileFailure(cause, 'voice.xai.release_audio'));
  }, [clearConnectTimeout, clearPlayback, stopStream]);

  const runAudioOperation = useCallback((generation: number, operation: () => Promise<void>) => {
    const current = () => activeRef.current && generationRef.current === generation;
    const pending = enqueueAudioOperation(async () => {
      if (!current()) return false;
      try { await operation(); }
      catch (cause) { if (current()) throw cause; }
      if (!current()) {
        stopStream();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        return false;
      }
      return true;
    });
    return pending;
  }, [stopStream]);

  const resumeListening = useCallback(async () => {
    if (!activeRef.current || stream.isStreaming) return;
    const generation = generationRef.current;
    try {
      clearPlayback();
      if (!(await runAudioOperation(generation, async () => { if (!stream.isStreaming) await stream.start(); }))) return;
      if (!activeRef.current || generationRef.current !== generation) return;
      setResponseFinished(false);
      setStatus('listening');
    } catch (cause) {
      if (!activeRef.current || generationRef.current !== generation) return;
      stop();
      captureMobileFailure(cause, 'voice.xai.resume_microphone');
      setErrorMessage('The microphone could not resume.');
      setStatus('error');
    }
  }, [clearPlayback, runAudioOperation, stop, stream]);

  const handleEvent = useCallback(
    (event: XaiEvent) => {
      const type = event.type;
      if (!type) return;

      if (type === 'session.updated') {
        configuredRef.current = true;
        clearConnectTimeout();
        setStatus('listening');
        return;
      }

      if (type === 'input_audio_buffer.speech_started') {
        setStatus('listening');
        return;
      }

      if (type === 'input_audio_buffer.speech_stopped') {
        setStatus('thinking');
        return;
      }

      if (
        type === 'conversation.item.input_audio_transcription.updated' ||
        type === 'conversation.item.input_audio_transcription.completed'
      ) {
        const transcript = event.transcript;
        if (!transcript) return;
        const itemId = event.item_id ?? `user-${Date.now().toString()}`;
        upsertTurn(itemId, 'user', transcript);
        return;
      }

      if (type === 'response.created') {
        const responseId =
          event.response?.id ?? `assistant-${Date.now().toString()}`;
        responseIdRef.current = responseId;
        responseHasAudioRef.current = false;
        outputChunksRef.current = [];
        outputByteLengthRef.current = 0;
        setResponseFinished(false);
        upsertTurn(responseId, 'assistant', '');
        stopStream();
        setStatus('thinking');
        return;
      }

      if (
        type === 'response.output_audio_transcript.delta' ||
        type === 'response.audio_transcript.delta'
      ) {
        const delta = event.delta;
        const responseId = event.response_id ?? responseIdRef.current;
        if (delta && responseId) {
          upsertTurn(responseId, 'assistant', delta, true);
        }
        return;
      }

      if (
        type === 'response.output_audio.delta' ||
        type === 'response.audio.delta'
      ) {
        const delta = event.delta;
        if (!delta) return;
        const bytes = base64ToBytes(delta);
        outputChunksRef.current.push(bytes);
        outputByteLengthRef.current += bytes.byteLength;
        if (outputByteLengthRef.current >= PLAYBACK_BATCH_BYTES) {
          queueOutputAudio();
        }
        setStatus('speaking');
        return;
      }

      if (
        type === 'response.output_audio.done' ||
        type === 'response.audio.done'
      ) {
        queueOutputAudio();
        return;
      }

      if (type === 'response.done') {
        responseIdRef.current = null;
        setResponseFinished(true);
        if (!responseHasAudioRef.current) void resumeListening();
        return;
      }

      if (type === 'ping') {
        const pingTimestamp = event.ping_timestamp;
        const socket = webSocketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'pong',
              ping_timestamp: pingTimestamp,
            }),
          );
        }
        return;
      }

      if (type === 'error') {
        const message =
          event.message ??
          event.error?.message ??
          'The live voice session hit a problem.';
        stop();
        setErrorMessage(message);
        setStatus('error');
      }
    },
    [
      clearConnectTimeout,
      queueOutputAudio,
      resumeListening,
      stopStream,
      stop,
      upsertTurn,
    ],
  );

  const start = useCallback(async () => {
    if (activeRef.current) return;
    if (process.env.EXPO_OS === 'web') {
      setErrorMessage('Conversational voice is available in the mobile app.');
      setStatus('error');
      return;
    }

    const generation = ++generationRef.current;
    const sessionIsCurrent = () => activeRef.current && generationRef.current === generation;
    activeRef.current = true;
    configuredRef.current = false;
    setTurns([]);
    setErrorMessage(undefined);
    setResponseFinished(false);
    setStatus('connecting');

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!sessionIsCurrent()) return;
      if (!permission.granted) {
        throw new Error(
          'Microphone access is off. Enable it in Settings to talk live.',
        );
      }

      const { token, websocketUrl } = await createRealtimeVoiceToken();
      if (!sessionIsCurrent()) return;
      if (!(await runAudioOperation(generation, async () => {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix', shouldRouteThroughEarpiece: false });
        if (sessionIsCurrent()) await stream.start();
      }))) return;
      if (!sessionIsCurrent()) return;

      const inputSampleRate = stream.sampleRate || OUTPUT_SAMPLE_RATE;
      const socket = new WebSocket(websocketUrl, [
        `bee-voice.${token}`,
      ]);
      webSocketRef.current = socket;
      const socketIsCurrent = () => sessionIsCurrent() && webSocketRef.current === socket;

      socket.onopen = () => {
        if (!socketIsCurrent()) {
          socket.close(1000, 'Conversation ended');
          return;
        }
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
                  format: { type: 'audio/pcm', rate: inputSampleRate },
                  transcription: { model: 'grok-transcribe' },
                },
                output: {
                  format: {
                    type: 'audio/pcm',
                    rate: OUTPUT_SAMPLE_RATE,
                  },
                },
              },
            },
          }),
        );
      };

      socket.onmessage = ({ data }) => {
        if (!socketIsCurrent()) return;
        const text = z.string().safeParse(data);
        if (!text.success) return;
        try {
          const event = xaiEventSchema.safeParse(JSON.parse(text.data));
          if (event.success) handleEvent(event.data);
        } catch (cause) {
          captureMobileFailure(cause, 'voice.xai.event');
        }
      };

      socket.onerror = () => {
        if (!socketIsCurrent()) return;
        stop();
        setErrorMessage('Bee could not connect to conversational voice.');
        setStatus('error');
      };

      socket.onclose = ({ code }) => {
        if (!socketIsCurrent()) return;
        stop();
        setErrorMessage(`The live voice session ended (${code}).`);
        setStatus('error');
      };

      connectTimeoutRef.current = setTimeout(() => {
        if (configuredRef.current || !socketIsCurrent()) return;
        stop();
        setErrorMessage('Conversational voice took too long to connect.');
        setStatus('error');
      }, 10_000);

      if (process.env.EXPO_OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (cause) {
      if (!sessionIsCurrent()) return;
      stop();
      captureMobileFailure(cause, 'voice.xai.start');
      setErrorMessage(
        cause instanceof Error
          ? cause.message
          : 'Conversational voice could not start.',
      );
      setStatus('error');
    }
  }, [handleEvent, runAudioOperation, stop, stream]);

  useEffect(() => {
    if (
      responseFinished &&
      responseHasAudioRef.current &&
      playlistStatus.didJustFinish
    ) {
      void resumeListening();
    }
  }, [playlistStatus.didJustFinish, responseFinished, resumeListening]);

  useEffect(() => stop, [stop]);

  const isActive =
    status === 'connecting' ||
    status === 'listening' ||
    status === 'thinking' ||
    status === 'speaking';
  const orbState: OrbState =
    status === 'listening'
      ? 'listening'
      : status === 'thinking' || status === 'connecting'
        ? 'thinking'
        : status === 'speaking'
          ? 'speaking'
          : 'idle';

  return {
    status,
    isActive,
    orbState,
    turns,
    errorMessage,
    start,
    stop,
  };
}


