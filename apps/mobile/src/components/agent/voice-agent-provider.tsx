import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { ListeningIsland } from '@/components/agent/listening-island';
import { useVoiceAgent } from '@/hooks/use-voice-agent';
import { onMicPress } from '@/lib/mic-bus';

type VoiceAgent = ReturnType<typeof useVoiceAgent>;

const VoiceAgentContext = createContext<VoiceAgent | null>(null);

/**
 * Hosts the voice agent above the tab navigator so the mic, the Live Activity,
 * and the in-app island pill keep working from every screen — tab screens can
 * be frozen while inactive, which used to pause all of this outside the chat.
 */
export function VoiceAgentProvider({ children }: PropsWithChildren) {
  const agent = useVoiceAgent();

  // The Talk tab button reaches the agent from any tab through the mic bus.
  const { toggleRecording } = agent;
  useEffect(() => onMicPress(toggleRecording), [toggleRecording]);

  // Once the user finishes talking, land back in the chat so the transcript
  // and Bee's reply are immediately visible.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !agent.recording) {
      router.navigate('/');
    }
    wasRecording.current = agent.recording;
  }, [agent.recording]);

  return (
    <VoiceAgentContext.Provider value={agent}>
      {children}
      <ListeningIsland state={agent.orbState} />
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
