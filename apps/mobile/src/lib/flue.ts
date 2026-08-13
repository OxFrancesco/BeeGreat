import { getClerkInstance } from '@clerk/clerk-expo';
import { createFlueClient } from '@flue/sdk';

// BeeGreat keeps its Flue worker on a dedicated local port to avoid Vite collisions.
export const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL ?? 'http://localhost:3583';

export const BEE_AGENT_NAME = 'bee';

/**
 * Clerk session token headers for the agent worker, which verifies them
 * server-side. The session can be briefly unavailable (cold start, resuming
 * from background), so wait for a token instead of sending an unauthenticated
 * request that the worker rejects with a 401.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const token = await getClerkInstance().session?.getToken();
      if (token) return { authorization: `Bearer ${token}` };
    } catch {
      // Token fetch failed (e.g. network blip); retry below.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {};
}

/**
 * Flue 2.0 clients are conversation-scoped: one client per conversation URL
 * (the agent's mount path plus the conversation id). Each client owns its own
 * live subscriptions; a fresh one forces a reconnect.
 */
export function createBeeFlueClient(
  conversationId: string,
  _reconnectVersion = 0,
) {
  return createFlueClient({
    url: `${AGENT_URL}/agents/${BEE_AGENT_NAME}/${conversationId}`,
    headers: getAuthHeaders,
  });
}
