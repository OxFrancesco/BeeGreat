import type { ConversationLiveMode } from '@flue/sdk';

export function resolveBeeAgentLiveMode(value?: string): ConversationLiveMode {
  return value?.trim().toLowerCase() === 'long-poll' ? 'long-poll' : 'sse';
}

/** SSE is the production default; long-poll remains an emergency rollback. */
export const BEE_AGENT_LIVE_MODE = resolveBeeAgentLiveMode(
  process.env.EXPO_PUBLIC_FLUE_LIVE_MODE,
);
