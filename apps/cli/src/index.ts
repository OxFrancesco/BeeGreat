#!/usr/bin/env bun

import { createInterface } from "node:readline/promises";

import { createClerkCliAuth } from "./clerk-auth";
import { parseCommand } from "./command";
import { createThreadStateStore, resolveBeeCliConfig } from "./config";
import { createCredentialStore } from "./credential-store";
import { createTerminalProgress } from "./progress";
import { projectBeeReply } from "./reply";
import { createBeeSession } from "./session";

const HELP = `BeeGreat CLI

Usage:
  bee                         Start an interactive conversation
  bee ask <message>           Ask Bee once
  bee <message>               Ask Bee once (short form)
  bee new                     Start a fresh CLI conversation
  bee login                   Sign in through Clerk in your browser
  bee logout                  Revoke and remove the local Clerk session
  bee help                    Show this help

Interactive commands:
  /new                        Start a fresh conversation
  /exit                       Leave Bee

Configuration:
  BEE_AGENT_URL               Agent URL (default: http://localhost:3583)
  BEE_CLERK_CLIENT_ID         Public Clerk OAuth application client id
`;

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /fetch failed|unable to connect|connection refused|ECONNREFUSED/i.test(
      message,
    )
  ) {
    return "Could not reach Bee. Start the agent with `bun run agent` or set BEE_AGENT_URL.";
  }
  if (/401|sign in|unauthorized/i.test(message)) {
    return "Your Clerk session was rejected. Run `bun run bee -- login` again.";
  }
  return message;
}

async function main() {
  let command = parseCommand(process.argv.slice(2));
  const interactiveInput =
    process.stdin.isTTY || process.env.BEE_CLI_INTERACTIVE === "1";
  if (command.kind === "chat" && !interactiveInput) {
    const prompt = (await Bun.stdin.text()).trim();
    if (prompt) command = { kind: "ask", prompt };
  }
  if (command.kind === "help") {
    console.log(HELP);
    return;
  }

  const config = resolveBeeCliConfig(process.env);
  const credentialStore = createCredentialStore({
    account: `${config.clerkIssuer}|${config.clerkClientId}`,
    fallbackPath: config.credentialPath,
    warn: (message) => console.error(`Bee CLI: ${message}`),
  });
  const auth = createClerkCliAuth(
    { issuer: config.clerkIssuer, clientId: config.clerkClientId },
    { store: credentialStore },
  );
  if (command.kind === "logout") {
    await auth.logout();
    console.log("Signed out of BeeGreat CLI.");
    return;
  }
  const clerk = await auth.session({ forceLogin: command.kind === "login" });
  if (command.kind === "login") {
    console.log("Signed in to BeeGreat CLI.");
    return;
  }
  const session = createBeeSession(
    {
      agentUrl: config.agentUrl,
      userId: clerk.userId,
      getToken: async () => (await auth.session()).accessToken,
    },
    createThreadStateStore({
      agentUrl: config.agentUrl,
      userId: clerk.userId,
      statePath: config.statePath,
    }),
  );
  const progress = createTerminalProgress((line) => console.error(`  ${line}`));

  async function ask(prompt: string) {
    console.error("  Bee is thinking…");
    const raw = await session.ask(prompt, progress);
    return projectBeeReply(raw) || "Bee finished without a text reply.";
  }

  if (command.kind === "ask") {
    console.log(await ask(command.prompt));
    return;
  }
  if (command.kind === "new") {
    await session.newConversation();
    console.log("New CLI conversation started.");
    return;
  }

  console.log("BeeGreat CLI — type /help for commands or /exit to leave.\n");
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    while (true) {
      const prompt = (await terminal.question("You › ")).trim();
      if (!prompt) continue;
      if (prompt === "/exit" || prompt === "/quit") break;
      if (prompt === "/help") {
        console.log("\n/new  Start a fresh conversation\n/exit Leave Bee\n");
        continue;
      }
      if (prompt === "/new") {
        await session.newConversation();
        console.log("\nNew conversation started.\n");
        continue;
      }
      console.log(`\nBee › ${await ask(prompt)}\n`);
    }
  } finally {
    terminal.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(`Bee CLI: ${friendlyError(error)}`);
  process.exitCode = 1;
}
