import { useAuth } from '@clerk/clerk-expo';
import { useFlueAgent } from '@flue/react';
import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { OrbState } from '@/components/agent/voice-orb';
import { useBeeLiveActivity } from '@/hooks/use-live-activity';
import {
  useActiveChatThread,
  useChatThreadActions,
  useConvexMessages,
} from '@/hooks/use-convex-chat';
import { createBeeFlueClient } from '@/lib/flue';
import {
  confirmPendingFirstFocus,
  isFirstFocusConfirmation,
  isHighlightCompletion,
} from '@/lib/first-focus-confirmation';
import {
  getSpeakReplies,
  subscribeSpeakReplies,
  useSpeakReplies,
} from '@/lib/preferences';
import { BEE_AGENT_LIVE_MODE } from '@/lib/flue-transport';
import { captureMobileFailure } from '@/lib/sentry';
import { getToolCopy } from '@/lib/tool-labels';
import { extractBeeUI } from '@/lib/ui-spec';
import { synthesizeSpeech, transcribeRecording } from '@/lib/voice-api';

function isAuthHiccup(error: Error | undefined) {
  return Boolean(error && /401|sign in/i.test(error.message));
}

/** Turns raw transport errors into copy fit for the chat. */
function friendlyErrorMessage(error: Error | undefined): string | undefined {
  if (!error) return undefined;
  if (isAuthHiccup(error)) return 'Reconnecting to Bee\u2026';
  if (/^HTTP Error \d+/i.test(error.message)) {
    return 'Bee couldn\u2019t reach the hive \u2014 check your connection.';
  }
  return error.message;
}

export function useVoiceAgent() {
  // This hook only renders behind the signed-in route guard, so userId is always set.
  const { userId } = useAuth();
  const thread = useActiveChatThread();
  const { createThread, titleThread } = useChatThreadActions();
  // Thread 0 keeps the original `userId` conversation; later threads append a
  // `~N` suffix (the agent strips it to recover the user id for its tools).
  const conversationId = userId ? (thread > 0 ? `${userId}~${thread}` : userId) : 'signed-out';
  // Flue 2.0 clients are conversation-scoped, so a thread switch needs a
  // client addressed at the new conversation URL.
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const client = useMemo(
    () => createBeeFlueClient(conversationId, reconnectVersion),
    [conversationId, reconnectVersion],
  );
  const agent = useFlueAgent({
    live: BEE_AGENT_LIVE_MODE,
    client,
  });
  const chatHistory = useConvexMessages(thread, agent.messages);
  const hideMessages = useMutation(api.chat.hideMessages);
  const currentFirstFocus = useQuery(api.firstFocus.getCurrent, {});
  const completeHighlight = useMutation(api.firstFocus.completeHighlight);
  const syncTimeZone = useMutation(api.user.syncTimeZone);
  const activeHighlight = currentFirstFocus?.activeHighlight;

  useEffect(() => {
    if (!userId) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;
    void syncTimeZone({ timeZone }).catch(() => {
      // Scheduling falls back to UTC if preferences are temporarily offline.
    });
  }, [syncTimeZone, userId]);

  // The SDK treats 401 as fatal and stops polling, but for us it's a transient
  // auth hiccup (Clerk token not ready right after launch/resume). Swap in a
  // fresh client to force a full reconnect, backing off between attempts.
  const reconnectAttempts = useRef(0);
  useEffect(() => {
    if (!isAuthHiccup(agent.error)) {
      if (!agent.error) reconnectAttempts.current = 0;
      return;
    }
    const delay = Math.min(1500 * 2 ** reconnectAttempts.current++, 15000);
    const timer = setTimeout(
      () => setReconnectVersion((version) => version + 1),
      delay,
    );
    return () => clearTimeout(timer);
  }, [agent.error, conversationId]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();
  const speakReplies = useSpeakReplies();

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | undefined>();

  const spokenIds = useRef(new Set<string>());
  const seededHistory = useRef(false);

  // A new thread is a brand-new conversation: restart speech bookkeeping.
  useEffect(() => {
    spokenIds.current.clear();
    seededHistory.current = false;
  }, [conversationId]);

  // Label the thread with its first user message so the thread list is legible.
  useEffect(() => {
    const first = agent.messages.find((message) => message.role === 'user');
    if (!first) return;
    const text = first.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join(' ');
    void titleThread(thread, text.slice(0, 64));
  }, [agent.messages, thread, titleThread]);

  // Don't read pre-existing history aloud on launch.
  useEffect(() => {
    if (!agent.historyReady || seededHistory.current) return;
    seededHistory.current = true;
    for (const message of agent.messages) {
      spokenIds.current.add(message.id);
    }
  }, [agent.historyReady, agent.messages]);

  // Speak each assistant reply once it has fully streamed in.
  useEffect(() => {
    if (!seededHistory.current || agent.status !== 'idle') return;
    const latest = [...agent.messages].reverse().find((message) => message.role === 'assistant');
    if (!latest || spokenIds.current.has(latest.id)) return;
    if (!speakReplies) {
      // Voice replies are off: mark as handled so toggling back on later
      // doesn't read old messages aloud.
      spokenIds.current.add(latest.id);
      return;
    }
    if (latest.parts.some((part) => part.type === 'text' && part.state === 'streaming')) return;
    spokenIds.current.add(latest.id);

    const text = latest.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    const { spoken } = extractBeeUI(text);
    if (!spoken) return;

    let cancelled = false;
    (async () => {
      try {
        const uri = await synthesizeSpeech(spoken);
        if (cancelled) return;
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
        player.replace(uri);
        player.play();
        setSpeaking(true);
      } catch (cause) {
        captureMobileFailure(cause, 'voice.synthesize_or_play');
        // Voice output failed; the reply is still on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.status, agent.messages, player, speakReplies]);

  // Cut off any in-progress speech when voice replies are turned off.
  useEffect(
    () =>
      subscribeSpeakReplies(() => {
        if (getSpeakReplies()) return;
        player.pause();
        setSpeaking(false);
      }),
    [player],
  );

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setSpeaking(false);
    });
    return () => subscription.remove();
  }, [player]);

  /** Ends the current conversation and starts a fresh thread. */
  const resetConversation = useCallback(async () => {
    setVoiceError(undefined);
    player.pause();
    setSpeaking(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await createThread();
  }, [createThread, player]);

  const sendText = useCallback(
    async (text: string) => {
      // Slash commands: `/clear` and `/new` restart the conversation.
      const command = text.trim().toLowerCase();
      if (command === '/clear' || command === '/new') {
        await resetConversation();
        return;
      }
      setVoiceError(undefined);
      if (speaking) {
        player.pause();
        setSpeaking(false);
      }
      // A visible first-focus preview is authoritative. Voice transcripts and
      // typed confirmations take the same authenticated client mutation path
      // as tapping the card, avoiding a second server-side interpretation.
      if (isFirstFocusConfirmation(text)) {
        const confirmation = await confirmPendingFirstFocus();
        if (confirmation === 'confirmed') {
          await agent.sendMessage(
            '[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again.',
          );
          return;
        }
        if (confirmation === 'failed') return;
      }
      // Completion stays in the authenticated client just like the Hive tap.
      // Explicit voice transcripts and typed commands share the same stable
      // idempotency key, so a retry can never award progress twice.
      if (isHighlightCompletion(text) && activeHighlight) {
        const highlight = activeHighlight;
        try {
          const result = await completeHighlight({
            requestId: `complete-highlight:${highlight.highlightId}`,
            taskId: highlight.taskId as Id<'tasks'>,
          });
          await agent.sendMessage(
            `[BeeGreat app event] Highlight "${highlight.title}" was completed successfully. The verified award was ${result.honeyAwarded} Honey and ${result.scoreAwarded} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again.`,
          );
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (cause) {
          captureMobileFailure(cause, 'highlight.complete');
          setVoiceError(
            cause instanceof Error ? cause.message : 'This Highlight could not be completed.',
          );
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return;
      }
      try {
        await agent.sendMessage(text);
      } catch (cause) {
        captureMobileFailure(cause, 'agent.send_message');
        setVoiceError('Your message wasn’t sent. Check your connection and try again.');
        throw cause;
      }
    },
    [
      agent,
      completeHighlight,
      activeHighlight,
      player,
      resetConversation,
      speaking,
    ],
  );

  /**
   * Removes the latest reply and re-runs its user input. Flue's transcript is
   * append-only, so the superseded turn is tombstoned in Convex (hidden on
   * every device) and the same text is submitted again as a fresh turn.
   */
  const retryLastReply = useCallback(async () => {
    if (agent.status === 'submitted' || agent.status === 'streaming') return;
    const messages = chatHistory.messages;
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === 'user',
    );
    if (lastUserIndex < 0) return;
    const retriedText = messages[lastUserIndex].parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
    if (!retriedText.trim()) return;
    // Hide the retried user turn and everything after it. User rows are keyed
    // by submission id in Convex, so tombstone both key forms.
    const messageIds = messages.slice(lastUserIndex).flatMap((message) => [
      message.id,
      ...(message.role === 'user' && message.submissionId
        ? [`submission:${message.submissionId}`]
        : []),
    ]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await hideMessages({ threadId: thread, messageIds });
      await sendText(retriedText);
    } catch (cause) {
      captureMobileFailure(cause, 'chat.retry');
      setVoiceError('The retry didn’t go through. Check your connection and try again.');
    }
  }, [agent.status, chatHistory.messages, hideMessages, sendText, thread]);

  const toggleRecording = useCallback(async () => {
    setVoiceError(undefined);
    try {
      if (recording) {
        setRecording(false);
        await recorder.stop();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const uri = recorder.uri;
        if (!uri) throw new Error('Nothing was recorded.');
        setTranscribing(true);
        try {
          const transcript = await transcribeRecording(uri);
          if (transcript) {
            await sendText(transcript);
          } else {
            setVoiceError('I didn\u2019t catch that \u2014 try again.');
          }
        } finally {
          setTranscribing(false);
        }
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('Microphone access is off. Enable it in Settings to talk to Bee.');
        return;
      }
      if (speaking) {
        player.pause();
        setSpeaking(false);
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRecording(true);
    } catch (error) {
      captureMobileFailure(error, recording ? 'voice.transcribe' : 'voice.record');
      setRecording(false);
      setTranscribing(false);
      setVoiceError(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }, [recording, recorder, sendText, speaking, player]);

  const busy = agent.status === 'submitted' || agent.status === 'streaming';
  const orbState: OrbState = recording
    ? 'listening'
    : transcribing || busy
      ? 'thinking'
      : speaking
        ? 'speaking'
        : 'idle';

  // Mirror agent state (and the tool it is running) into the native Dynamic Island.
  const lastMessage = agent.messages.at(-1);
  const runningTool =
    busy && lastMessage?.role === 'assistant'
      ? lastMessage.parts
          .filter((part) => part.type === 'dynamic-tool' && part.state === 'input-available')
          .at(-1)
      : undefined;
  const activityDetail =
    runningTool?.type === 'dynamic-tool'
      ? getToolCopy(runningTool.toolName, 'running', runningTool.input).label
      : '';
  useBeeLiveActivity(orbState, activityDetail);

  return {
    ...agent,
    thread,
    messages: chatHistory.messages,
    canLoadOlder: chatHistory.canLoadOlder,
    loadingOlder: chatHistory.loadingOlder,
    loadOlder: chatHistory.loadOlder,
    orbState,
    recording,
    busy,
    voiceError,
    errorMessage: voiceError ?? friendlyErrorMessage(agent.error),
    sendText,
    retryLastReply,
    toggleRecording,
    resetConversation,
  };
}
