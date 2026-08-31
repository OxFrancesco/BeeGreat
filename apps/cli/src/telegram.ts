import {
  isFiniteJsonNumber,
  isJsonObject,
  isJsonString,
  type JsonObject,
  type JsonValue,
} from "./json";

type TelegramCommand = {
  action: "connect" | "status" | "disconnect" | "notify";
  message?: string;
};

/** Every request body the CLI Telegram route accepts. */
type TelegramChannelRequest =
  | { action: "connect" | "status" | "disconnect" }
  | { action: "notify"; text: string };

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type TelegramStatus = {
  status: "missing" | "pending" | "connected" | "needs_reauth" | "failed";
  displayName?: string;
  username?: string;
  message?: string;
};

type TelegramDependencies = {
  fetch?: Fetcher;
  openBrowser?(url: string): Promise<void>;
  sleep?(milliseconds: number): Promise<void>;
};

async function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  const child = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  if ((await child.exited) !== 0) {
    throw new Error(`Open this URL to connect Telegram:\n${url}`);
  }
}

function describeStatus(status: TelegramStatus) {
  if (status.status === "connected") {
    const account = status.username
      ? `@${status.username}`
      : (status.displayName ?? "your account");
    return `Telegram is connected as ${account}.`;
  }
  if (status.status === "pending")
    return "Telegram connection is waiting for approval.";
  if (status.status === "needs_reauth")
    return status.message ?? "Telegram needs to be reconnected.";
  if (status.status === "failed")
    return status.message ?? "Telegram connection failed.";
  return "Telegram is not connected.";
}

function errorMessage(body: JsonValue, fallback: string) {
  return isJsonObject(body) && isJsonString(body.error) ? body.error : fallback;
}

const TELEGRAM_STATUSES = [
  "missing",
  "pending",
  "connected",
  "needs_reauth",
  "failed",
] as const;

/** Reads the agent's Telegram status payload; unknown statuses read as missing. */
function parseTelegramStatus(payload: JsonValue): TelegramStatus {
  const record: JsonObject = isJsonObject(payload) ? payload : {};
  const status =
    TELEGRAM_STATUSES.find((known) => known === record.status) ?? "missing";
  const parsed: TelegramStatus = { status };
  if (isJsonString(record.displayName)) parsed.displayName = record.displayName;
  if (isJsonString(record.username)) parsed.username = record.username;
  if (isJsonString(record.message)) parsed.message = record.message;
  return parsed;
}

type TelegramNotifyReceipt = { messageId: number };

function parseNotifyReceipt(payload: JsonValue): TelegramNotifyReceipt {
  if (isJsonObject(payload) && isFiniteJsonNumber(payload.messageId)) {
    return { messageId: payload.messageId };
  }
  throw new Error("Bee returned an invalid Telegram notify receipt.");
}

type TelegramAuthorization = { authorizationUrl: string };

function parseAuthorization(payload: JsonValue): TelegramAuthorization {
  if (isJsonObject(payload) && isJsonString(payload.authorizationUrl)) {
    return { authorizationUrl: payload.authorizationUrl };
  }
  throw new Error("Bee returned an invalid Telegram connect response.");
}

function ignoredReply(): undefined {
  return undefined;
}

async function telegramRequest<T>(
  agentUrl: string,
  accessToken: string,
  body: TelegramChannelRequest,
  fetcher: Fetcher,
  parse: (payload: JsonValue) => T,
): Promise<T> {
  const response = await fetcher(
    `${agentUrl.replace(/\/$/, "")}/cli/telegram`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const result: JsonValue = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      errorMessage(
        result,
        `Bee Telegram request failed (HTTP ${response.status}).`,
      ),
    );
  }
  return parse(result);
}

async function waitForConnection(
  config: { agentUrl: string; accessToken: string },
  fetcher: Fetcher,
  sleep: (milliseconds: number) => Promise<void>,
) {
  const expiresAt = Date.now() + 10 * 60_000;
  while (Date.now() < expiresAt) {
    const status = await telegramRequest(
      config.agentUrl,
      config.accessToken,
      { action: "status" },
      fetcher,
      parseTelegramStatus,
    );
    if (status.status === "connected") return status;
    if (status.status === "failed" || status.status === "needs_reauth") {
      throw new Error(describeStatus(status));
    }
    await sleep(750);
  }
  throw new Error("Telegram connection timed out.");
}

export async function runTelegramCommand(
  command: TelegramCommand,
  config: { agentUrl: string; accessToken: string },
  dependencies: TelegramDependencies = {},
) {
  const fetcher = dependencies.fetch ?? fetch;
  const launchBrowser = dependencies.openBrowser ?? openBrowser;
  const sleep = dependencies.sleep ?? Bun.sleep;

  if (command.action === "status") {
    const status = await telegramRequest(
      config.agentUrl,
      config.accessToken,
      { action: "status" },
      fetcher,
      parseTelegramStatus,
    );
    return describeStatus(status);
  }
  if (command.action === "disconnect") {
    await telegramRequest(
      config.agentUrl,
      config.accessToken,
      { action: "disconnect" },
      fetcher,
      ignoredReply,
    );
    return "Telegram disconnected from BeeGreat.";
  }
  if (command.action === "notify") {
    const result = await telegramRequest(
      config.agentUrl,
      config.accessToken,
      { action: "notify", text: command.message! },
      fetcher,
      parseNotifyReceipt,
    );
    return `Sent to Telegram (message ${result.messageId}).`;
  }

  const current = await telegramRequest(
    config.agentUrl,
    config.accessToken,
    { action: "status" },
    fetcher,
    parseTelegramStatus,
  );
  if (current.status === "connected") return describeStatus(current);
  const { authorizationUrl } = await telegramRequest(
    config.agentUrl,
    config.accessToken,
    { action: "connect" },
    fetcher,
    parseAuthorization,
  );
  await launchBrowser(authorizationUrl);
  console.error("  Approve BeeGreat in Telegram…");
  return describeStatus(await waitForConnection(config, fetcher, sleep));
}

export async function runBuddyTg(args: string[]) {
  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn(["buddytg", ...args], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch {
    throw new Error("BuddyTG is not installed on PATH.");
  }
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
