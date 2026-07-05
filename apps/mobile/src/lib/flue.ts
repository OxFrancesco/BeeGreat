import { getClerkInstance } from '@clerk/clerk-expo';
import { createFlueClient } from '@flue/sdk';

export const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL ?? 'http://localhost:3583';

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

/** Each client owns its own live subscriptions; a fresh one forces a reconnect. */
export function createBeeFlueClient() {
  return createFlueClient({ baseUrl: AGENT_URL, headers: getAuthHeaders });
}

export const flueClient = createBeeFlueClient();

export const BEE_AGENT_NAME = 'bee';
