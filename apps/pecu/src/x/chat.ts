import { z } from "zod";
import { jsonValueSchema, type JsonValue } from "../json-contract";
import { createChat, type ChatWithJuicebox, type SigningKeyEntry } from "@xdevplatform/chat-xdk";
import type { Config } from "../config";
import type { PublicKeyRecord, XApi } from "./api";

function snakeCaseKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(snakeCaseKeys);
  if (!value || Object(value) !== value) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      snakeCaseKeys(nested),
    ]),
  );
}

export function normalizeJuiceboxConfig(config: JsonValue): string {
  const text = z.string().safeParse(config);
  const parsed = text.success ? jsonValueSchema.parse(JSON.parse(text.data)) : config;
  return JSON.stringify(snakeCaseKeys(parsed));
}

export function realmTokens(configJson: string): Map<string, string> {
  const entry = z.object({ key: z.string(), value: z.object({ token: z.string() }) });
  const config = z.object({ token_map: z.array(jsonValueSchema).optional().catch(undefined), tokenMap: z.array(jsonValueSchema).optional().catch(undefined) }).parse(JSON.parse(configJson));
  const tokens = new Map<string, string>();
  for (const raw of config.token_map ?? config.tokenMap ?? []) {
    const parsed = entry.safeParse(raw);
    if (parsed.success) tokens.set(parsed.data.key.toLowerCase(), parsed.data.value.token);
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
