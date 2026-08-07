import {
  createFlueClient,
  type ConversationStreamChunk,
  type CreateFlueClientOptions,
  type FlueClient,
} from "@flue/sdk";

import {
  parseBeeReply,
  type FirstFocusConfirmation,
  type Web3Confirmation,
} from "./reply";

export type BeeSessionConfig = {
  agentUrl: string;
  userId: string;
  getToken(): Promise<string>;
};

export type ThreadStateStore = {
  load(): Promise<number | undefined>;
  save(threadId: number): Promise<void>;
};

type BeeSessionDependencies = {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  createClient(options: CreateFlueClientOptions): FlueClient;
};

function normalizedUrl(value: string) {
  return value.replace(/\/$/, "");
}

function errorMessage(body: unknown, fallback: string) {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return fallback;
}

export function createBeeSession(
  config: BeeSessionConfig,
  state: ThreadStateStore,
  dependencies: Partial<BeeSessionDependencies> = {},
) {
  const fetcher = dependencies.fetch ?? fetch;
  const makeClient = dependencies.createClient ?? createFlueClient;
  const agentUrl = normalizedUrl(config.agentUrl);
  let threadId: number | undefined;
  let loaded = false;
  let needsTitle = false;
  let client: FlueClient | undefined;
  let pendingFirstFocus: FirstFocusConfirmation | undefined;
  let pendingWeb3: Web3Confirmation | undefined;

  async function channelAction<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetcher(`${agentUrl}/cli/channel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await config.getToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      if (response.status === 404 && result === null) {
        throw new Error(
          `No Bee agent route was found at ${agentUrl}/cli/channel. Another service may be using that address. Start Bee with \`bun run agent\` and set BEE_AGENT_URL to the URL it prints.`,
        );
      }
      throw new Error(
        errorMessage(
          result,
          `Bee CLI request failed (HTTP ${response.status}).`,
        ),
      );
    }
    return result as T;
  }

  async function createThread() {
    const result = await channelAction<{ threadId?: unknown }>({
      action: "create_cli_thread",
    });
    if (
      typeof result.threadId !== "number" ||
      !Number.isFinite(result.threadId)
    ) {
      throw new Error("Bee returned an invalid CLI conversation.");
    }
    threadId = result.threadId;
    client = undefined;
    loaded = true;
    needsTitle = true;
    await state.save(threadId);
    return threadId;
  }

  async function currentThread() {
    if (!loaded) {
      threadId = await state.load();
      loaded = true;
    }
    return threadId ?? createThread();
  }

  async function conversation() {
    if (client) return client;
    const id = await currentThread();
    client = makeClient({
      url: `${agentUrl}/agents/bee/${encodeURIComponent(`${config.userId}~${id}`)}`,
      headers: async () => ({
        authorization: `Bearer ${await config.getToken()}`,
      }),
    });
    return client;
  }

  return {
    async ask(
      prompt: string,
      onEvent?: (event: ConversationStreamChunk) => void,
    ) {
      let deliveredPrompt = prompt;
      const confirms =
        /^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$/i.test(
          prompt.trim(),
        );
      const cancels = /^(no|nope|cancel|never mind|nevermind)[.!]?$/i.test(
        prompt.trim(),
      );
      if (pendingFirstFocus && (confirms || cancels)) {
        await channelAction({
          action: confirms ? "confirm_first_focus" : "cancel_first_focus",
          ...pendingFirstFocus,
        });
        deliveredPrompt = confirms
          ? "[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again."
          : "[BeeGreat app event] The first-focus preview was cancelled. Nothing was created. Acknowledge the cancellation; do not create or mutate the plan.";
        pendingFirstFocus = undefined;
      } else if (
        pendingWeb3 &&
        (/^yes[.!]?$/i.test(prompt.trim()) || /^no[.!]?$/i.test(prompt.trim()))
      ) {
        const confirmed = /^yes[.!]?$/i.test(prompt.trim());
        const current = await channelAction<Record<string, unknown> | null>({
          action: "get_web3_action",
          actionId: pendingWeb3.actionId,
        });
        if (
          !current ||
          typeof current.summary !== "string" ||
          typeof current.status !== "string"
        ) {
          throw new Error("This Web3 confirmation is no longer available.");
        }
        if (current.status === "pending") {
          await channelAction({
            action: confirmed ? "confirm_web3" : "cancel_web3",
            actionId: pendingWeb3.actionId,
            summary: current.summary,
          });
          deliveredPrompt = confirmed
            ? `[BeeGreat trusted CLI event] The user explicitly authorized the exact Web3 action ${JSON.stringify(current.summary)} and Convex accepted confirmation for action ${pendingWeb3.actionId}. Delegate to the Web3 specialist and check that exact action now. Report its current execution status without preparing a replacement or asking for another confirmation.`
            : `[BeeGreat trusted CLI event] The user declined the exact Web3 action ${JSON.stringify(current.summary)}. Convex cancelled action ${pendingWeb3.actionId}; no funds moved. Acknowledge the cancellation without preparing a replacement.`;
        } else {
          deliveredPrompt = `[BeeGreat trusted CLI event] The user replied to Web3 action ${JSON.stringify(current.summary)}, but Convex reports it is already ${current.status}; no new decision was applied. Check action ${pendingWeb3.actionId} and report its current status without preparing a replacement.`;
        }
        pendingWeb3 = undefined;
      }
      const target = await conversation();
      const id = await currentThread();
      if (needsTitle) {
        await channelAction({
          action: "title_thread",
          threadId: id,
          title: prompt.slice(0, 64),
        }).catch(() => undefined);
        needsTitle = false;
      }
      const admission = await target.send({
        message: { kind: "user", body: deliveredPrompt },
      });
      let currentStepText = "";
      let finalStepText = "";
      const result = await target.read(admission, {
        onEvent(event) {
          if (event.type === "message-started") {
            currentStepText = "";
          } else if (event.type === "message-delta" && event.kind === "text") {
            currentStepText += event.delta;
          } else if (
            event.type === "message-completed" &&
            currentStepText.trim()
          ) {
            finalStepText = currentStepText;
          }
          onEvent?.(event);
        },
      });
      // Flue deliberately accumulates every agent step in one assistant
      // message. A CLI chat should present the final spoken step, otherwise a
      // pre-tool draft and the final answer look like duplicated responses.
      const replyText = (finalStepText || currentStepText).trim() || result.text;
      const parsed = parseBeeReply(replyText);
      pendingFirstFocus = parsed.firstFocus;
      pendingWeb3 = parsed.web3Confirmation;
      return replyText;
    },

    async newConversation() {
      pendingFirstFocus = undefined;
      pendingWeb3 = undefined;
      return await createThread();
    },
  };
}
