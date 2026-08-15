import {
  createFlueClient,
  type ConversationStreamChunk,
  type CreateFlueClientOptions,
  type FlueClient,
} from "@flue/sdk";

import {
  humanizeWeb3Summary,
  projectTextWeb3Action,
  type TextWeb3Action,
} from "@beegreat/tool-presentation";

import {
  parseBeeReply,
  resolveQuestionAnswer,
  type BeeFollowUp,
  type BeeQuestion,
  type FirstFocusConfirmation,
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

type BeeSessionDependencies = {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  createClient(options: CreateFlueClientOptions): FlueClient;
};

function canonicalWeb3Reply(action: TextWeb3Action): BeeAskResult {
  const projected = projectTextWeb3Action(action);
  return {
    text: [projected.text, ...projected.links].filter(Boolean).join("\n"),
    ...(projected.requiresTextConfirmation
      ? {
          followUp: {
            kind: "confirm" as const,
            summary: humanizeWeb3Summary(action.summary),
          },
        }
      : {}),
  };
}

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
  let pendingQuestion: BeeQuestion | undefined;

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
        const current = await channelAction<
          (TextWeb3Action & { id: string }) | null
        >({
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
        if (
          current.status === "pending" &&
          confirmed &&
          current.kind === "execute_eoa_plan"
        ) {
          pendingWeb3 = undefined;
          return canonicalWeb3Reply(current);
        }
        if (current.status === "pending") {
          await channelAction({
            action: confirmed ? "confirm_web3" : "cancel_web3",
            actionId: pendingWeb3.actionId,
            summary: current.summary,
          });
        }
        pendingWeb3 = undefined;
        const decisionApplied =
          current.status === "pending" &&
          !(confirmed && current.kind === "execute_eoa_plan");
        const updated = await channelAction<
          (TextWeb3Action & { id: string }) | null
        >({
          action: "get_web3_action",
          actionId: current.id,
        });
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
      const replyText =
        (finalStepText || currentStepText).trim() || result.text;
      const parsed = parseBeeReply(replyText);
      pendingFirstFocus = parsed.firstFocus;
      pendingQuestion = parsed.question;
      if (parsed.web3Confirmation) {
        const current = await channelAction<
          (TextWeb3Action & { id: string }) | null
        >({
          action: "get_web3_action",
          actionId: parsed.web3Confirmation.actionId,
        });
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
      const followUp: BeeFollowUp | undefined = parsed.firstFocus
        ? { kind: "confirm", summary: "Create this first-focus plan?" }
        : parsed.web3Confirmation
          ? {
              kind: "confirm",
              summary: humanizeWeb3Summary(parsed.web3Confirmation.summary),
            }
          : parsed.confirmation
            ? { kind: "confirm", summary: parsed.confirmation.summary }
            : parsed.question
              ? { kind: "question", question: parsed.question }
              : undefined;
      return { text: replyText, ...(followUp ? { followUp } : {}) };
    },

    async newConversation() {
      pendingFirstFocus = undefined;
      pendingWeb3 = undefined;
      pendingQuestion = undefined;
      return await createThread();
    },
  };
}
