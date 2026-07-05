import { useAuth } from '@clerk/clerk-expo';
import { useFlueAgent } from '@flue/react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { OrbState } from '@/components/agent/voice-orb';
import { useBeeLiveActivity } from '@/hooks/use-live-activity';
import { BEE_AGENT_NAME, flueClient } from '@/lib/flue';
import { getToolCopy } from '@/lib/tool-labels';
import { extractBeeUI } from '@/lib/ui-spec';
import { synthesizeSpeech, transcribeRecording } from '@/lib/voice-api';

export function useVoiceAgent() {
  // This hook only renders behind the signed-in route guard, so userId is always set.
  const { userId } = useAuth();
  const agent = useFlueAgent({
    name: BEE_AGENT_NAME,
    id: userId ?? 'signed-out',
    live: 'long-poll',
    client: flueClient,
  });

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | undefined>();

  const spokenIds = useRef(new Set<string>());
  const seededHistory = useRef(false);

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
    const latest = [...agent.messages]
      .reverse()
      .find((message) => message.role === 'assistant');
    if (!latest || spokenIds.current.has(latest.id)) return;
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
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        player.replace(uri);
        player.play();
        setSpeaking(true);
      } catch {
        // Voice output failed; the reply is still on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agent.status, agent.messages, player]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) setSpeaking(false);
    });
    return () => subscription.remove();
  }, [player]);

  const sendText = useCallback(
    async (text: string) => {
      setVoiceError(undefined);
      if (speaking) {
        player.pause();
        setSpeaking(false);
      }
      await agent.sendMessage(text);
    },
    [agent, player, speaking],
  );

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
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRecording(true);
    } catch (error) {
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
    runningTool?.type === 'dynamic-tool' ? getToolCopy(runningTool.toolName, 'running').label : '';
  useBeeLiveActivity(orbState, activityDetail);

  return {
    ...agent,
    orbState,
    recording,
    busy,
    voiceError,
    sendText,
    toggleRecording,
  };
}
