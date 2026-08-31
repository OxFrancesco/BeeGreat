import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { ListeningIsland } from '@/components/agent/listening-island';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { useXaiVoiceConversation } from '@/hooks/use-xai-voice-conversation';
import { onMicPress } from '@/lib/mic-bus';
import { type VoiceMode, useVoiceMode } from '@/lib/preferences';

type VoiceAgent = ReturnType<typeof useVoiceAgent> & {
  voiceMode: VoiceMode;
  conversation: ReturnType<typeof useXaiVoiceConversation>;
};

const VoiceAgentContext = createContext<VoiceAgent | null>(null);

/**
 * Hosts the voice agent above the tab navigator so the mic, the Live Activity,
 * and the in-app island pill keep working from every screen — tab screens can
 * be frozen while inactive, which used to pause all of this outside the chat.
 */
export function VoiceAgentProvider({ children }: PropsWithChildren) {
  const voiceNoteAgent = useVoiceAgent();
  const conversation = useXaiVoiceConversation();
  const voiceMode = useVoiceMode();
  const toggleVoiceNoteRecording = voiceNoteAgent.toggleRecording;

  const toggleRecording = useCallback(async () => {
    if (voiceMode === 'conversation') {
      router.push('/voice-conversation');
      return;
    }
    await toggleVoiceNoteRecording();
  }, [toggleVoiceNoteRecording, voiceMode]);

  const agent = {
    ...voiceNoteAgent,
    voiceMode,
    conversation,
    toggleRecording,
    recording:
      voiceMode === 'conversation'
        ? conversation.isActive
        : voiceNoteAgent.recording,
    orbState:
      voiceMode === 'conversation' && conversation.isActive
        ? conversation.orbState
        : voiceNoteAgent.orbState,
    voiceError:
      voiceMode === 'conversation'
        ? conversation.errorMessage
        : voiceNoteAgent.voiceError,
    errorMessage:
      voiceMode === 'conversation'
        ? conversation.errorMessage
        : voiceNoteAgent.errorMessage,
  };

  // The Talk tab button reaches the agent from any tab through the mic bus.
  useEffect(() => onMicPress(toggleRecording), [toggleRecording]);

  // Once the user finishes talking, land back in the chat so the transcript
  // and Bee's reply are immediately visible.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !voiceNoteAgent.recording) {
      router.navigate('/');
    }
    wasRecording.current = voiceNoteAgent.recording;
  }, [voiceNoteAgent.recording]);

  return (
    <VoiceAgentContext.Provider value={agent}>
      {children}
      <ListeningIsland
        state={agent.orbState}
        onPress={
          conversation.isActive
            ? () => router.push('/voice-conversation')
            : undefined
        }
      />
    </VoiceAgentContext.Provider>
  );
}

export function useVoiceAgentContext(): VoiceAgent {
  const agent = useContext(VoiceAgentContext);
  if (!agent) {
    throw new Error('useVoiceAgentContext must be used inside VoiceAgentProvider');
  }
  return agent;
}
