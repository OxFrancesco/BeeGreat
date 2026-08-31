import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { isFiniteJsonNumber, isJsonObject, type JsonValue } from "./json";
import type { ThreadStateStore } from "./session";

type Environment = Record<string, string | undefined>;

export type ResolvedBeeCliConfig = {
  agentUrl: string;
  autoStartAgent: boolean;
  projectRoot?: string;
  clerkIssuer: string;
  clerkClientId: string;
  statePath: string;
  historyPath: string;
  credentialPath: string;
  agentLogPath: string;
};

export function resolveBeeCliConfig(
  environment: Environment,
): ResolvedBeeCliConfig {
  const clerkIssuer = (
    environment.BEE_CLERK_ISSUER ?? environment.CLERK_JWT_ISSUER_DOMAIN
  )
    ?.trim()
    .replace(/\/$/, "");
  if (!clerkIssuer) {
    throw new Error(
      "Set CLERK_JWT_ISSUER_DOMAIN (or BEE_CLERK_ISSUER) to your Clerk issuer URL.",
    );
  }
  const clerkClientId = environment.BEE_CLERK_CLIENT_ID?.trim();
  if (!clerkClientId) {
    throw new Error(
      "Set BEE_CLERK_CLIENT_ID to the public Bee CLI OAuth client id.",
    );
  }

  const agentUrl = (environment.BEE_AGENT_URL ?? "http://localhost:3583")
    .trim()
    .replace(/\/$/, "");
  const parsedUrl = URL.parse(agentUrl);
  if (
    !parsedUrl ||
    (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
  ) {
    throw new Error("BEE_AGENT_URL must be an HTTP or HTTPS URL.");
  }

  const configHome =
    environment.XDG_CONFIG_HOME?.trim() || join(homedir(), ".config");
  const beeConfigHome = join(configHome, "beegreat");
  const config: ResolvedBeeCliConfig = {
    agentUrl,
    autoStartAgent: environment.BEE_AGENT_AUTOSTART !== "0",
    clerkIssuer,
    clerkClientId,
    statePath:
      environment.BEE_CLI_STATE_PATH?.trim() || join(beeConfigHome, "cli.json"),
    historyPath:
      environment.BEE_CLI_HISTORY_PATH?.trim() ||
      join(beeConfigHome, "prompt-history.jsonl"),
    credentialPath:
      environment.BEE_CLI_CREDENTIAL_PATH?.trim() ||
      join(beeConfigHome, "credentials.json"),
    agentLogPath:
      environment.BEE_AGENT_LOG_PATH?.trim() || join(beeConfigHome, "agent.log"),
  };
  const projectRoot = environment.BEE_PROJECT_ROOT?.trim();
  if (projectRoot) config.projectRoot = projectRoot;
  return config;
}

export function createThreadStateStore(config: {
  agentUrl: string;
  userId: string;
  statePath: string;
}): ThreadStateStore {
  return {
    async load() {
      try {
        const stored: JsonValue = JSON.parse(
          await readFile(config.statePath, "utf8"),
        );
        return isJsonObject(stored) &&
          stored.agentUrl === config.agentUrl &&
          stored.userId === config.userId &&
          isFiniteJsonNumber(stored.threadId)
          ? stored.threadId
          : undefined;
      } catch {
        return undefined;
      }
    },
    async save(threadId) {
      await mkdir(dirname(config.statePath), { recursive: true, mode: 0o700 });
      await writeFile(
        config.statePath,
        `${JSON.stringify(
          {
            version: 1,
            agentUrl: config.agentUrl,
            userId: config.userId,
            threadId,
          },
          null,
          2,
        )}\n`,
        { mode: 0o600 },
      );
    },
  };
}
