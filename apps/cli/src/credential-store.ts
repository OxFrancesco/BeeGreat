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

async function runSecurity(args: string[]) {
  const child = Bun.spawn(["security", ...args], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = await new Response(child.stdout).text();
  return { exitCode: await child.exited, output: output.trim() };
}

export function createCredentialStore(options: {
  account: string;
  fallbackPath: string;
  warn?: (message: string) => void;
}): CredentialStore {
  const service = "com.beegreat.cli";
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
      if (process.platform === "darwin") {
        try {
          const result = await runSecurity([
            "find-generic-password",
            "-s",
            service,
            "-a",
            options.account,
            "-w",
          ]);
          if (result.exitCode === 0) {
            const value: JsonValue = JSON.parse(result.output);
            if (validCredentials(value)) return value;
          }
        } catch {
          warnFallback();
        }
      } else {
        warnFallback();
      }
      return await loadFile();
    },

    async save(credentials) {
      if (process.platform === "darwin") {
        try {
          const result = await runSecurity([
            "add-generic-password",
            "-U",
            "-s",
            service,
            "-a",
            options.account,
            "-w",
            JSON.stringify(credentials),
          ]);
          if (result.exitCode === 0) {
            await rm(options.fallbackPath, { force: true });
            return;
          }
        } catch {
          // Fall through to the protected file store.
        }
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
      if (process.platform === "darwin") {
        try {
          await runSecurity([
            "delete-generic-password",
            "-s",
            service,
            "-a",
            options.account,
          ]);
        } catch {
          // The key may not exist.
        }
      }
      await rm(options.fallbackPath, { force: true });
    },
  };
}
