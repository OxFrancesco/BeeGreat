import { access, mkdir, open } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

import { isJsonObject, type JsonValue } from "./json";

type AgentHealth = "ready" | "unreachable" | "occupied";

type SpawnedAgent = {
  exited?: Promise<number>;
  unref(): void;
};

type AgentSpawnOptions = {
  cwd: string;
  detached: true;
  env: NodeJS.ProcessEnv;
  stdin: "ignore";
  stdout: "ignore" | number;
  stderr: "ignore" | number;
};

type AgentLogHandle = {
  fd: number;
  close(): Promise<void>;
};

type AgentRuntimeDependencies = {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  spawn(command: string[], options: AgentSpawnOptions): SpawnedAgent;
  findProjectRoot(): Promise<string | undefined>;
  openLog(path: string): Promise<AgentLogHandle>;
  sleep(milliseconds: number): Promise<void>;
};

export type EnsureBeeAgentOptions = {
  agentUrl: string;
  autoStart: boolean;
  projectRoot?: string;
  logPath?: string;
  onStatus?(message: string): void;
};

export type BeeAgentStatus = "remote" | "ready" | "started";

// The first Cloudflare sandbox launch can build its local container image.
const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const STATUS_INTERVAL_MS = 15_000;

function isLoopback(url: URL) {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "::1"
  );
}

async function isBeeProjectRoot(path: string) {
  try {
    await Promise.all([
      access(join(path, "package.json")),
      access(join(path, "packages", "agent", "package.json")),
    ]);
    const manifest: JsonValue = await Bun.file(
      join(path, "package.json"),
    ).json();
    return isJsonObject(manifest) && manifest.name === "beegreat";
  } catch {
    return false;
  }
}

async function walkToProjectRoot(start: string) {
  let current = start;
  const filesystemRoot = parse(current).root;
  while (true) {
    if (await isBeeProjectRoot(current)) return current;
    if (current === filesystemRoot) return undefined;
    current = dirname(current);
  }
}

export async function findBeeProjectRoot() {
  for (const start of [process.cwd(), import.meta.dir]) {
    const root = await walkToProjectRoot(start);
    if (root) return root;
  }
  return undefined;
}

async function agentHealth(
  agentUrl: string,
  fetcher: AgentRuntimeDependencies["fetch"],
): Promise<AgentHealth> {
  try {
    const response = await fetcher(`${agentUrl}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return "occupied";
    const body: JsonValue = await response.json().catch(() => null);
    return isJsonObject(body) && body.service === "beegreat-agent"
      ? "ready"
      : "occupied";
  } catch {
    return "unreachable";
  }
}

const defaultDependencies: AgentRuntimeDependencies = {
  fetch,
  spawn: (command, options) => Bun.spawn(command, options),
  findProjectRoot: findBeeProjectRoot,
  openLog: async (path) => {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    return await open(path, "a", 0o600);
  },
  sleep: (milliseconds) => Bun.sleep(milliseconds),
};

export async function ensureBeeAgent(
  options: EnsureBeeAgentOptions,
  dependencies: Partial<AgentRuntimeDependencies> = {},
): Promise<BeeAgentStatus> {
  const runtime = { ...defaultDependencies, ...dependencies };
  const url = new URL(options.agentUrl);
  if (!isLoopback(url)) return "remote";

  const initialHealth = await agentHealth(options.agentUrl, runtime.fetch);
  if (initialHealth === "ready") return "ready";
  if (initialHealth === "occupied") {
    throw new Error(
      `${url.host} is already in use by something other than BeeGreat. Stop that service or set BEE_AGENT_URL.`,
    );
  }
  if (!options.autoStart) {
    throw new Error(
      "Bee's local agent is not running and automatic startup is disabled.",
    );
  }

  const projectRoot =
    options.projectRoot?.trim() || (await runtime.findProjectRoot());
  if (!projectRoot || !(await isBeeProjectRoot(projectRoot))) {
    throw new Error(
      "Bee could not find its local BeeGreat installation. Set BEE_PROJECT_ROOT to the repository path.",
    );
  }

  options.onStatus?.("Waking up the local Bee agent…");
  const log = options.logPath
    ? await runtime.openLog(options.logPath)
    : undefined;
  let child: SpawnedAgent;
  try {
    child = runtime.spawn(["bun", "run", "agent"], {
      cwd: projectRoot,
      detached: true,
      env: process.env,
      stdin: "ignore",
      stdout: log?.fd ?? "ignore",
      stderr: log?.fd ?? "ignore",
    });
  } finally {
    await log?.close();
  }
  let exitCode: number | undefined;
  void child.exited?.then((code) => {
    exitCode = code;
  });
  child.unref();

  const startedAt = Date.now();
  const deadline = startedAt + READY_TIMEOUT_MS;
  let lastStatusAt = startedAt;
  while (Date.now() < deadline) {
    await runtime.sleep(POLL_INTERVAL_MS);
    if (Date.now() - lastStatusAt >= STATUS_INTERVAL_MS) {
      lastStatusAt = Date.now();
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      options.onStatus?.(
        `Still waking up the local Bee agent… ${seconds}s (the first start can take up to two minutes)`,
      );
    }
    if (exitCode !== undefined) {
      throw new Error(
        `Bee's local agent exited during startup (code ${exitCode}). Run \`bun run agent\` in the BeeGreat repository to inspect the error.`,
      );
    }
    const health = await agentHealth(options.agentUrl, runtime.fetch);
    if (health === "ready") return "started";
    if (health === "occupied") {
      throw new Error(
        `${url.host} became occupied before Bee's agent could start.`,
      );
    }
  }
  throw new Error(
    "Bee's local agent did not become ready. Run `bun run agent` in the BeeGreat repository to inspect the startup error.",
  );
}
