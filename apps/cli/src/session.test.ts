import { describe, expect, test } from "bun:test";
import type { FlueClient } from "@flue/sdk";

import { createBeeSession, type ThreadStateStore } from "./session";

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
        createClient: () =>
          ({
            send: async ({ message }: { message: { body: string } }) => {
              prompts.push(message.body);
              return { submissionId: `submission-${prompts.length}` };
            },
            read: async () => ({ text: replies.shift() ?? "Done." }),
          }) as unknown as FlueClient,
      },
    );

    await session.ask("Move the position");
    await session.ask("2");

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
        createClient: () =>
          ({
            send: async () => ({ submissionId: "submission-1" }),
            read: async (
              _admission: unknown,
              options: { onEvent?: (event: unknown) => void },
            ) => {
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
          }) as unknown as FlueClient,
      },
    );

    await expect(session.ask("How are you?")).resolves.toBe(
      "I'm doing great—thanks! What's on your mind?",
    );
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
            send: async () => ({ submissionId: "submission-1" }),
            read: async () => ({ text: "Keep going." }),
          } as unknown as FlueClient;
        },
      },
    );

    await expect(session.ask("What is next?")).resolves.toBe("Keep going.");
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
    const actions: Record<string, unknown>[] = [];
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
            send: async () => ({ submissionId: `submission-${url}` }),
            read: async () => ({ text: "Done." }),
          } as unknown as FlueClient;
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
    const actions: Record<string, unknown>[] = [];
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
        createClient: () =>
          ({
            send: async ({ message }: { message: { body: string } }) => {
              prompts.push(String(message.body));
              return { submissionId: `submission-${prompts.length}` };
            },
            read: async () => ({ text: replies.shift() ?? "" }),
          }) as unknown as FlueClient,
      },
    );

    await session.ask("Help me begin");
    await expect(session.ask("yes")).resolves.toBe("Created.");

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
    const actions: Record<string, unknown>[] = [];
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
          const action = JSON.parse(String(init?.body)) as Record<
            string,
            unknown
          >;
          actions.push(action);
          if (action.action === "confirm_web3") status = "confirmed";
          return action.action === "get_web3_action"
            ? Response.json({
                id: "action-1",
                summary: "Swap 10 USDC for ETH",
                kind: "socket_swap",
                status,
                autoConfirmed: false,
              })
            : Response.json(null);
        },
        createClient: () =>
          ({
            send: async ({ message }: { message: { body: string } }) => {
              prompts.push(message.body);
              return { submissionId: `submission-${prompts.length}` };
            },
            read: async () => ({ text: replies.shift() ?? "" }),
          }) as unknown as FlueClient,
      },
    );

    expect(await session.ask("Prepare the swap")).toContain(
      "Needs your confirmation",
    );
    expect(await session.ask("yes")).toContain("Web3 action in progress");

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
    const actions: Record<string, unknown>[] = [];
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
          const action = JSON.parse(String(init?.body)) as Record<
            string,
            unknown
          >;
          actions.push(action);
          return action.action === "get_web3_action"
            ? Response.json({
                id: "action-eoa",
                summary: "Claim fees from your linked wallet",
                kind: "execute_eoa_plan",
                status: "pending",
                autoConfirmed: false,
              })
            : Response.json(null);
        },
        createClient: () =>
          ({
            send: async ({ message }: { message: { body: string } }) => {
              prompts.push(message.body);
              return { submissionId: `submission-${prompts.length}` };
            },
            read: async () => ({
              text: `\`\`\`beeui\n{"components":[{"type":"confirm","summary":"Claim fees","action":"web3","payload":{"web3ActionId":"action-eoa"}}]}\n\`\`\``,
            }),
          }) as unknown as FlueClient,
      },
    );

    expect(await session.ask("Claim my fees")).toContain(
      "Open BeeGreat to sign",
    );
    await session.ask("yes");

    expect(actions).toEqual([
      { action: "get_web3_action", actionId: "action-eoa" },
      { action: "get_web3_action", actionId: "action-eoa" },
    ]);
    expect(prompts).toEqual(["Claim my fees"]);
  });
});
