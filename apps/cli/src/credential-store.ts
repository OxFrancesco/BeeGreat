import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  isFiniteJsonNumber,
  isJsonObject,
  isJsonString,
  type JsonValue,
} from "./json";

export type ClerkCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
};

export type CredentialStore = {
  load(): Promise<ClerkCredentials | undefined>;
  save(credentials: ClerkCredentials): Promise<void>;
  clear(): Promise<void>;
};

function validCredentials(value: JsonValue): value is ClerkCredentials {
  return (
    isJsonObject(value) &&
    isJsonString(value.accessToken) &&
    isJsonString(value.refreshToken) &&
    isFiniteJsonNumber(value.expiresAt) &&
    isJsonString(value.userId)
  );
}

export function createCredentialStore(options: {
  account: string;
  fallbackPath: string;
  warn?: (message: string) => void;
  secrets?: typeof Bun.secrets;
}): CredentialStore {
  const service = "com.beegreat.cli";
  const secrets = options.secrets ?? Bun.secrets;
  let warned = false;

  function warnFallback() {
    if (warned) return;
    warned = true;
    options.warn?.(
      `OS keychain unavailable; Clerk credentials are stored in ${options.fallbackPath} with mode 0600.`,
    );
  }

  async function loadFile() {
    try {
      const value: JsonValue = JSON.parse(
        await readFile(options.fallbackPath, "utf8"),
      );
      return validCredentials(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  return {
    async load() {
      const fallback = await loadFile();
      if (fallback) return fallback;
      try {
        const value = await secrets.get({ service, name: options.account });
        if (value !== null) {
          const parsed: JsonValue = JSON.parse(value);
          if (validCredentials(parsed)) return parsed;
        }
      } catch { warnFallback(); }
      return undefined;
    },

    async save(credentials) {
      try {
        await secrets.set({ service, name: options.account, value: JSON.stringify(credentials) });
        await rm(options.fallbackPath, { force: true });
        return;
      } catch {
        // Keep the newest credential in the protected fallback if Keychain fails.
      }
      warnFallback();
      await mkdir(dirname(options.fallbackPath), {
        recursive: true,
        mode: 0o700,
      });
      await writeFile(
        options.fallbackPath,
        `${JSON.stringify(credentials, null, 2)}\n`,
        { mode: 0o600 },
      );
    },

    async clear() {
      try { await secrets.delete({ service, name: options.account }); }
      catch { /* The operating system store may be unavailable. */ }
      await rm(options.fallbackPath, { force: true });
    },
  };
}
