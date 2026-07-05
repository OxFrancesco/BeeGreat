import { getClerkInstance } from '@clerk/clerk-expo';
import { createFlueClient } from '@flue/sdk';

export const AGENT_URL = process.env.EXPO_PUBLIC_AGENT_URL ?? 'http://localhost:3583';

/** Clerk session token headers for the agent worker, which verifies them server-side. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getClerkInstance().session?.getToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export const flueClient = createFlueClient({ baseUrl: AGENT_URL, headers: getAuthHeaders });

export const BEE_AGENT_NAME = 'bee';
