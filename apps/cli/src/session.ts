import {
  createFlueClient,
  type AgentReadOptions,
  type AgentSendResult,
  type ConversationStreamChunk,
  type CreateFlueClientOptions,
} from "@flue/sdk";

import {
  humanizeWeb3Summary,
  projectTextWeb3Action,
  type TextWeb3Action,
} from "@beegreat/tool-presentation";

import {
  isFiniteJsonNumber,
  isJsonObject,
  isJsonString,
  type JsonValue,
} from "./json";
import {
  deriveFollowUp,
  parseBeeReply,
  resolveQuestionAnswer,
  type BeeFollowUp,
  type BeeQuestion,
  type FirstFocusPreview,
  type Web3Confirmation,
} from "./reply";

export type BeeAskResult = {
  text: string;
  followUp?: BeeFollowUp;
};

export type BeeSessionConfig = {
  agentUrl: string;
  userId: string;
  getToken(): Promise<string>;
};

export type ThreadStateStore = {
  load(): Promise<number | undefined>;
  save(threadId: number): Promise<void>;
};

/** The prompt the CLI session delivers into one Bee conversation. */
export type ConversationPrompt = {
  message: { kind: "user"; body: string };
};

/** The settled reply text the session reads back for one prompt. */
export type ConversationReply = {
  text: string;
};

/** The slice of a Flue conversation client the CLI session drives. */
export type ConversationClient = {
  send(options: ConversationPrompt): Promise<AgentSendResult>;
  read(
    admission: AgentSendResult,
    options: AgentReadOptions,
  ): Promise<ConversationReply>;
};

type BeeSessionDependencies = {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  createClient(options: CreateFlueClientOptions): ConversationClient;
};

/** A decision on a previewed first-focus plan, forwarded to the agent. */
type FirstFocusDecisionRequest = {
  action: "confirm_first_focus" | "cancel_first_focus";
  requestId: string;
  goalTitle: string;
  projectTitle: string;
  taskTitle: string;
  highlightExpiresAt?: number;
};

/** Every request body the CLI channel route accepts. */
type ChannelActionRequest =
  | { action: "create_cli_thread" }
  | { action: "title_thread"; threadId: number; title: string }
  | { action: "get_web3_action"; actionId: string }
  | { action: "confirm_web3" | "cancel_web3"; actionId: string; summary: string }
  | FirstFocusDecisionRequest;

/** The agent's canonical Web3 action record addressed by id. */
type CanonicalWeb3Action = TextWeb3Action & { id: string };

const WEB3_KINDS = [
  "send_tokens",
  "execute_plan",
  "execute_eoa_plan",
  "socket_swap",
] as const;

const WEB3_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "executed",
  "failed",
  "refunded",
  "cancelled",
  "expired",
] as const;

/** Parses a `get_web3_action` payload; a malformed record reads as absent. */
function parseWeb3Action(payload: JsonValue): CanonicalWeb3Action | null {
  if (!isJsonObject(payload)) return null;
  const status = WEB3_STATUSES.find((known) => known === payload.status);
  if (!isJsonString(payload.id) || !isJsonString(payload.summary) || !status) {
    return null;
  }
  const action: CanonicalWeb3Action = {
    id: payload.id,
    summary: payload.summary,
    status,
    autoConfirmed: payload.autoConfirmed === true,
  };
  const kind = WEB3_KINDS.find((known) => known === payload.kind);
  if (kind) action.kind = kind;
  if (isJsonString(payload.error)) action.error = payload.error;
  if (Array.isArray(payload.result)) {
    action.result = payload.result.map((item) => ({
      hash: isJsonObject(item) && isJsonString(item.hash) ? item.hash : null,
      explorerLink:
        isJsonObject(item) && isJsonString(item.explorerLink)
          ? item.explorerLink
          : null,
    }));
  }
  if (
    isJsonObject(payload.socketProgress) &&
    isJsonString(payload.socketProgress.detail)
  ) {
    const progress: NonNullable<TextWeb3Action["socketProgress"]> = {
      detail: payload.socketProgress.detail,
    };
    if (isJsonString(payload.socketProgress.destinationExplorerLink)) {
      progress.destinationExplorerLink =
        payload.socketProgress.destinationExplorerLink;
    }
    action.socketProgress = progress;
  }
  if (
    isJsonObject(payload.timing) &&
    isFiniteJsonNumber(payload.timing.estimatedTimeSeconds)
  ) {
    action.timing = {
      estimatedTimeSeconds: payload.timing.estimatedTimeSeconds,
    };
  }
  return action;
}

/** Parses a `create_cli_thread` payload into the registered thread id. */
function parseCliThread(payload: JsonValue): number {
  if (isJsonObject(payload) && isFiniteJsonNumber(payload.threadId)) {
    return payload.threadId;
  }
  throw new Error("Bee returned an invalid CLI conversation.");
}

function ignoredReply(): undefined {
  return undefined;
}

function canonicalWeb3Reply(action: TextWeb3Action): BeeAskResult {
  const projected = projectTextWeb3Action(action);
  const reply: BeeAskResult = {
    text: [projected.text, ...projected.links].filter(Boolean).join("\n"),
  };
  if (projected.requiresTextConfirmation) {
    reply.followUp = {
      kind: "confirm",
      summary: humanizeWeb3Summary(action.summary),
    };
  }
  return reply;
}

function normalizedUrl(value: string) {
  return value.replace(/\/$/, "");
}

function errorMessage(body: JsonValue, fallback: string) {
  if (isJsonObject(body) && isJsonString(body.error)) {
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
  let client: ConversationClient | undefined;
  let pendingFirstFocus: FirstFocusPreview | undefined;
  let pendingWeb3: Web3Confirmation | undefined;
  let pendingQuestion: BeeQuestion | undefined;

  async function channelAction<T>(
    body: ChannelActionRequest,
    parse: (payload: JsonValue) => T,
  ): Promise<T> {
    const response = await fetcher(`${agentUrl}/cli/channel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await config.getToken()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result: JsonValue = await response.json().catch(() => null);
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
    return parse(result);
  }

  async function createThread() {
    threadId = await channelAction(
      { action: "create_cli_thread" },
      parseCliThread,
    );
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
    ): Promise<BeeAskResult> {
      let deliveredPrompt = resolveQuestionAnswer(pendingQuestion, prompt);
      pendingQuestion = undefined;
      const confirms =
        /^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$/i.test(
          prompt.trim(),
        );
      const cancels = /^(no|nope|cancel|never mind|nevermind)[.!]?$/i.test(
        prompt.trim(),
      );
      if (pendingFirstFocus && (confirms || cancels)) {
        const decision: FirstFocusDecisionRequest = {
          action: confirms ? "confirm_first_focus" : "cancel_first_focus",
          requestId: pendingFirstFocus.requestId,
          goalTitle: pendingFirstFocus.goalTitle,
          projectTitle: pendingFirstFocus.projectTitle,
          taskTitle: pendingFirstFocus.taskTitle,
        };
        if (pendingFirstFocus.highlightExpiresAt) {
          decision.highlightExpiresAt = pendingFirstFocus.highlightExpiresAt;
        }
        await channelAction(decision, ignoredReply);
        deliveredPrompt = confirms
          ? "[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again."
          : "[BeeGreat app event] The first-focus preview was cancelled. Nothing was created. Acknowledge the cancellation; do not create or mutate the plan.";
        pendingFirstFocus = undefined;
      } else if (
        pendingWeb3 &&
        (/^yes[.!]?$/i.test(prompt.trim()) || /^no[.!]?$/i.test(prompt.trim()))
      ) {
        const confirmed = /^yes[.!]?$/i.test(prompt.trim());
        const current = await channelAction(
          { action: "get_web3_action", actionId: pendingWeb3.actionId },
          parseWeb3Action,
        );
        if (!current) {
          throw new Error("This Web3 confirmation is no longer available.");
        }
        if (
          current.status === "pending" &&
          confirmed &&
          current.kind === "execute_eoa_plan"
        ) {
          pendingWeb3 = undefined;
          return canonicalWeb3Reply(current);
        }
        if (current.status === "pending") {
          await channelAction(
            {
              action: confirmed ? "confirm_web3" : "cancel_web3",
              actionId: pendingWeb3.actionId,
              summary: current.summary,
            },
            ignoredReply,
          );
        }
        pendingWeb3 = undefined;
        const decisionApplied =
          current.status === "pending" &&
          !(confirmed && current.kind === "execute_eoa_plan");
        const updated = await channelAction(
          { action: "get_web3_action", actionId: current.id },
          parseWeb3Action,
        );
        return canonicalWeb3Reply(
          updated ?? {
            ...current,
            status: decisionApplied
              ? confirmed
                ? "confirmed"
                : "cancelled"
              : current.status,
          },
        );
      }
      const target = await conversation();
      const id = await currentThread();
      if (needsTitle) {
        await channelAction(
          { action: "title_thread", threadId: id, title: prompt.slice(0, 64) },
          ignoredReply,
        ).catch(() => undefined);
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
      const replyText =
        (finalStepText || currentStepText).trim() || result.text;
      const parsed = parseBeeReply(replyText);
      pendingFirstFocus = parsed.firstFocus;
      pendingQuestion = parsed.question;
      if (parsed.web3Confirmation) {
        const current = await channelAction(
          {
            action: "get_web3_action",
            actionId: parsed.web3Confirmation.actionId,
          },
          parseWeb3Action,
        );
        if (current) {
          pendingWeb3 =
            current.status === "pending"
              ? {
                  actionId: parsed.web3Confirmation.actionId,
                  summary: current.summary,
                }
              : undefined;
          return canonicalWeb3Reply(current);
        }
      }
      pendingWeb3 = parsed.web3Confirmation;
      const followUp = deriveFollowUp(parsed);
      const reply: BeeAskResult = { text: replyText };
      if (followUp) reply.followUp = followUp;
      return reply;
    },

    async newConversation() {
      pendingFirstFocus = undefined;
      pendingWeb3 = undefined;
      pendingQuestion = undefined;
      return await createThread();
    },
  };
}
