import { createChat, type ChatWithJuicebox, type SigningKeyEntry } from "@xdevplatform/chat-xdk";
import type { Config } from "../config";
import type { PublicKeyRecord, XApi } from "./api";

function snakeCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakeCaseKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      snakeCaseKeys(nested),
    ]),
  );
}

export function normalizeJuiceboxConfig(config: string | unknown): string {
  const parsed = typeof config === "string" ? JSON.parse(config) : config;
  return JSON.stringify(snakeCaseKeys(parsed));
}

export function realmTokens(configJson: string): Map<string, string> {
  const parsed = JSON.parse(configJson) as Record<string, unknown>;
  let entries: unknown[] = [];
  if (Array.isArray(parsed.token_map)) entries = parsed.token_map;
  else if (Array.isArray(parsed.tokenMap)) entries = parsed.tokenMap;
  const tokens = new Map<string, string>();
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as { key?: unknown; value?: { token?: unknown } };
    if (typeof entry.key === "string" && typeof entry.value?.token === "string") tokens.set(entry.key.toLowerCase(), entry.value.token);
  }
  return tokens;
}

export async function unlockChat(api: XApi, userId: string, config: Pick<Config, "chatPin">): Promise<ChatWithJuicebox> {
  const juicebox = await api.juicebox(userId);
  const normalizedConfig = normalizeJuiceboxConfig(juicebox.json);
  const tokens = realmTokens(normalizedConfig);
  const chat = await createChat({ juiceboxConfig: normalizedConfig, getAuthToken: async (realmId) => tokens.get(realmId.toLowerCase()) ?? "" });
  await chat.unlock(config.chatPin);
  chat.setIdentity(userId, juicebox.version);
  chat.setRejectUnverified(true);
  chat.setCacheKeys(true);
  return chat;
}

export function signingKeys(userId: string, keys: readonly PublicKeyRecord[]): SigningKeyEntry[] {
  return keys.flatMap((key) => {
    const publicKeyVersion = key.publicKeyVersion ?? key.public_key_version;
    const publicKey = key.signingPublicKey ?? key.signing_public_key;
    const identityPublicKey = key.publicKey ?? key.public_key;
    const identityPublicKeySignature = key.identityPublicKeySignature ?? key.identity_public_key_signature;
    return publicKeyVersion && publicKey && identityPublicKey && identityPublicKeySignature
      ? [{ userId, publicKeyVersion: String(publicKeyVersion), publicKey, identityPublicKey, identityPublicKeySignature }]
      : [];
  });
}
