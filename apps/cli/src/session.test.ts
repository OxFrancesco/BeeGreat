import { describe, expect, test } from "bun:test";
import type { AgentSendResult } from "@flue/sdk";

import { isJsonObject, type JsonValue } from "./json";
import { createBeeSession, type ThreadStateStore } from "./session";

/** A structurally complete admission receipt for fake conversation clients. */
function fakeAdmission(submissionId: string): AgentSendResult {
  return { streamUrl: "", offset: "-1", submissionId, uid: "uid-test" };
}

describe("Bee CLI session", () => {
  test("resumes the same conversation when a numbered question option is chosen", async () => {
    const prompts: string[] = [];
    const replies = [
      `One detail first.\n\`\`\`beeui\n{"components":[{"type":"question","questions":[{"header":"Network","question":"Which network should I use?","options":[{"label":"Base"},{"label":"Arbitrum"}]}]}]}\n\`\`\``,
      "Continuing on Arbitrum.",
    ];
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      { load: async () => 7, save: async () => undefined },
      {
        fetch: async () => Response.json(null),
        createClient: () => ({
          send: async ({ message }) => {
            prompts.push(message.body);
            return fakeAdmission(`submission-${prompts.length}`);
          },
          read: async () => ({ text: replies.shift() ?? "Done." }),
        }),
      },
    );

    const first = await session.ask("Move the position");
    await session.ask("2");

    expect(first.followUp).toEqual({
      kind: "question",
      question: {
        questions: [
          {
            header: "Network",
            question: "Which network should I use?",
            options: [{ label: "Base" }, { label: "Arbitrum" }],
          },
        ],
      },
    });
    expect(prompts).toEqual([
      "Move the position",
      "For “Which network should I use?”, my answer is “Arbitrum”.",
    ]);
  });

  test("returns only the final agent step when Flue accumulates multiple text steps", async () => {
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      { load: async () => 7, save: async () => undefined },
      {
        fetch: async () => Response.json(null),
        createClient: () => ({
          send: async () => fakeAdmission("submission-1"),
          read: async (_admission, options) => {
            const emit = options.onEvent;
            emit?.({
              type: "message-started",
              conversationId: "conversation-1",
              messageId: "message-1",
              position: { batch: 1, index: 0 },
            });
            emit?.({
              type: "message-delta",
              conversationId: "conversation-1",
              messageId: "message-1",
              kind: "text",
              delta: "I'm doing well, thanks! How are you?",
              position: { batch: 1, index: 1 },
            });
            emit?.({
              type: "message-started",
              conversationId: "conversation-1",
              messageId: "message-1",
              position: { batch: 1, index: 2 },
            });
            emit?.({
              type: "message-delta",
              conversationId: "conversation-1",
              messageId: "message-1",
              kind: "text",
              delta: "I'm doing great—thanks! What's on your mind?",
              position: { batch: 1, index: 3 },
            });
            emit?.({
              type: "message-completed",
              conversationId: "conversation-1",
              messageId: "message-1",
              position: { batch: 1, index: 4 },
            });
            return {
              text: "I'm doing well, thanks! How are you?\n\nI'm doing great—thanks! What's on your mind?",
            };
          },
        }),
      },
    );

    await expect(session.ask("How are you?")).resolves.toEqual({
      text: "I'm doing great—thanks! What's on your mind?",
    });
  });

  test("identifies a non-Bee service at the configured agent URL", async () => {
    const session = createBeeSession(
      {
        agentUrl: "http://localhost:5173",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      { load: async () => undefined, save: async () => undefined },
      {
        fetch: async () =>
          new Response("<!doctype html><title>Another Vite app</title>", {
            status: 404,
            headers: { "content-type": "text/html" },
          }),
        createClient: () => {
          throw new Error("conversation client should not be created");
        },
      },
    );

    await expect(session.ask("Hi!")).rejects.toThrow(
      "No Bee agent route was found at http://localhost:5173/cli/channel",
    );
  });

  test("registers its first thread and sends the prompt to that conversation", async () => {
    let savedThread: number | undefined;
    const state: ThreadStateStore = {
      load: async () => savedThread,
      save: async (threadId) => {
        savedThread = threadId;
      },
    };
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const conversations: string[] = [];
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test/",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      state,
      {
        fetch: async (input, init) => {
          requests.push({ url: String(input), init });
          return Response.json({ threadId: 42 });
        },
        createClient: (options) => {
          conversations.push(options.url);
          return {
            send: async () => fakeAdmission("submission-1"),
            read: async () => ({ text: "Keep going." }),
          };
        },
      },
    );

    await expect(session.ask("What is next?")).resolves.toEqual({
      text: "Keep going.",
    });
    expect(savedThread).toBe(42);
    expect(conversations).toEqual([
      "https://agent.example.test/agents/bee/user_owner~42",
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe("https://agent.example.test/cli/channel");
    expect(requests[0]?.init?.headers).toEqual({
      authorization: "Bearer clerk-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      action: "create_cli_thread",
    });
    expect(JSON.parse(String(requests[1]?.init?.body))).toMatchObject({
      action: "title_thread",
      threadId: 42,
      title: "What is next?",
    });
  });

  test("reuses saved history and rotates to a titled thread after new", async () => {
    let savedThread: number | undefined = 7;
    const state: ThreadStateStore = {
      load: async () => savedThread,
      save: async (threadId) => {
        savedThread = threadId;
      },
    };
    const actions: JsonValue[] = [];
    const conversations: string[] = [];
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      state,
      {
        fetch: async (_input, init) => {
          actions.push(JSON.parse(String(init?.body)));
          return Response.json({ threadId: 8 });
        },
        createClient: ({ url }) => {
          conversations.push(url);
          return {
            send: async () => fakeAdmission(`submission-${url}`),
            read: async () => ({ text: "Done." }),
          };
        },
      },
    );

    await session.ask("Continue");
    await session.newConversation();
    await session.ask("Fresh start");

    expect(conversations).toEqual([
      "https://agent.example.test/agents/bee/user_owner~7",
      "https://agent.example.test/agents/bee/user_owner~8",
    ]);
    expect(actions).toEqual([
      { action: "create_cli_thread" },
      { action: "title_thread", threadId: 8, title: "Fresh start" },
    ]);
  });

  test("persists a first-focus confirmation before Bee acknowledges it", async () => {
    let thread: number | undefined = 7;
    const actions: JsonValue[] = [];
    const prompts: string[] = [];
    const replies = [
      `Ready.\n\`\`\`beeui\n{"components":[{"type":"first_focus","requestId":"request-1","goalTitle":"Ship BeeGreat","projectTitle":"CLI","taskTitle":"Verify confirmations"}]}\n\`\`\``,
      "Created.",
    ];
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      {
        load: async () => thread,
        save: async (value) => {
          thread = value;
        },
      },
      {
        fetch: async (_input, init) => {
          actions.push(JSON.parse(String(init?.body)));
          return Response.json(null);
        },
        createClient: () => ({
          send: async ({ message }) => {
            prompts.push(String(message.body));
            return fakeAdmission(`submission-${prompts.length}`);
          },
          read: async () => ({ text: replies.shift() ?? "" }),
        }),
      },
    );

    const preview = await session.ask("Help me begin");
    expect(preview.followUp).toEqual({
      kind: "confirm",
      summary: "Create this first-focus plan?",
    });
    await expect(session.ask("yes")).resolves.toEqual({ text: "Created." });

    expect(actions).toEqual([
      {
        action: "confirm_first_focus",
        requestId: "request-1",
        goalTitle: "Ship BeeGreat",
        projectTitle: "CLI",
        taskTitle: "Verify confirmations",
      },
    ]);
    expect(prompts[1]).toContain("confirmed and persisted successfully");
  });

  test("checks canonical Web3 state before applying an exact yes decision", async () => {
    const actions: JsonValue[] = [];
    const prompts: string[] = [];
    const replies = [
      `Confirm this.\n\`\`\`beeui\n{"components":[{"type":"confirm","summary":"Swap 10 USDC for ETH","action":"web3","payload":{"web3ActionId":"action-1"}}]}\n\`\`\``,
    ];
    let status = "pending";
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      { load: async () => 7, save: async () => undefined },
      {
        fetch: async (_input, init) => {
          const action: JsonValue = JSON.parse(String(init?.body));
          actions.push(action);
          const kind = isJsonObject(action) ? action.action : undefined;
          if (kind === "confirm_web3") status = "confirmed";
          return kind === "get_web3_action"
            ? Response.json({
                id: "action-1",
                summary: "Swap 10 USDC for ETH",
                kind: "socket_swap",
                status,
                autoConfirmed: false,
              })
            : Response.json(null);
        },
        createClient: () => ({
          send: async ({ message }) => {
            prompts.push(message.body);
            return fakeAdmission(`submission-${prompts.length}`);
          },
          read: async () => ({ text: replies.shift() ?? "" }),
        }),
      },
    );

    const pending = await session.ask("Prepare the swap");
    expect(pending.text).toContain("Needs your confirmation");
    expect(pending.followUp).toEqual({
      kind: "confirm",
      summary: "Swap 10 USDC for ETH",
    });
    const confirmed = await session.ask("yes");
    expect(confirmed.text).toContain("Web3 action in progress");
    expect(confirmed.followUp).toBeUndefined();

    expect(actions).toEqual([
      { action: "get_web3_action", actionId: "action-1" },
      { action: "get_web3_action", actionId: "action-1" },
      {
        action: "confirm_web3",
        actionId: "action-1",
        summary: "Swap 10 USDC for ETH",
      },
      { action: "get_web3_action", actionId: "action-1" },
    ]);
    expect(prompts).toEqual(["Prepare the swap"]);
  });

  test("does not arm text confirmation for a linked-wallet action", async () => {
    const actions: JsonValue[] = [];
    const prompts: string[] = [];
    const session = createBeeSession(
      {
        agentUrl: "https://agent.example.test",
        userId: "user_owner",
        getToken: async () => "clerk-token",
      },
      { load: async () => 7, save: async () => undefined },
      {
        fetch: async (_input, init) => {
          const action: JsonValue = JSON.parse(String(init?.body));
          actions.push(action);
          const kind = isJsonObject(action) ? action.action : undefined;
          return kind === "get_web3_action"
            ? Response.json({
                id: "action-eoa",
                summary: "Claim fees from your linked wallet",
                kind: "execute_eoa_plan",
                status: "pending",
                autoConfirmed: false,
              })
            : Response.json(null);
        },
        createClient: () => ({
          send: async ({ message }) => {
            prompts.push(message.body);
            return fakeAdmission(`submission-${prompts.length}`);
          },
          read: async () => ({
            text: `\`\`\`beeui\n{"components":[{"type":"confirm","summary":"Claim fees","action":"web3","payload":{"web3ActionId":"action-eoa"}}]}\n\`\`\``,
          }),
        }),
      },
    );

    const pending = await session.ask("Claim my fees");
    expect(pending.text).toContain("Open BeeGreat to sign");
    expect(pending.followUp).toBeUndefined();
    await session.ask("yes");

    expect(actions).toEqual([
      { action: "get_web3_action", actionId: "action-eoa" },
      { action: "get_web3_action", actionId: "action-eoa" },
    ]);
    expect(prompts).toEqual(["Claim my fees"]);
  });
});
