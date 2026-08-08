#!/usr/bin/env bun

import { ensureBeeAgent } from "./agent-runtime";
import { createClerkCliAuth } from "./clerk-auth";
import { parseCommand } from "./command";
import { createThreadStateStore, resolveBeeCliConfig } from "./config";
import { createCredentialStore } from "./credential-store";
import { createTerminalProgress } from "./progress";
import { createPromptHistory } from "./prompt-history";
import { projectBeeReply, projectStreamingBeeReply } from "./reply";
import { createBeeSession } from "./session";
import { runBeeTui } from "./tui";
import { runBuddyTg, runTelegramCommand } from "./telegram";

const HELP = `BeeGreat CLI

Usage:
  bee                         Start an interactive conversation
  bee ask <message>           Ask Bee once
  bee <message>               Ask Bee once (short form)
  bee new                     Start a fresh CLI conversation
  bee login                   Sign in through Clerk in your browser
  bee logout                  Revoke and remove the local Clerk session
  bee telegram connect        Connect BeeGreat to your Telegram account
  bee telegram status         Show the BeeGreat Telegram connection
  bee telegram notify <text>  Send yourself a Telegram message through Bee
  bee telegram disconnect     Remove the BeeGreat Telegram connection
  bee buddytg <args...>       Run the full local BuddyTG CLI (macOS Keychain)
  bee help                    Show this help

Interactive commands:
  /new                        Start a fresh conversation
  /clear                      Clear the visible conversation
  /help                       Show commands and shortcuts
  /exit                       Leave Bee

Configuration:
  BEE_AGENT_URL               Agent URL (default: http://localhost:3583)
  BEE_AGENT_AUTOSTART         Set to 0 to disable local agent startup
  BEE_PROJECT_ROOT            BeeGreat repository path for local startup
  BEE_AGENT_LOG_PATH          Override local agent diagnostics log
  BEE_CLERK_CLIENT_ID         Public Clerk OAuth application client id
  BEE_CLI_HISTORY_PATH        Override prompt history storage
`;

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /fetch failed|unable to connect|connection refused|ECONNREFUSED/i.test(
      message,
    )
  ) {
    return "Bee could not reach its agent. Check BEE_AGENT_URL or the local BeeGreat installation.";
  }
  if (/401|sign in|unauthorized/i.test(message)) {
    return "Your Clerk session was rejected. Run `bee login` again.";
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
  if (command.kind === "buddytg") {
    await runBuddyTg(command.args);
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
  if (command.kind === "telegram") {
    await ensureBeeAgent({
      agentUrl: config.agentUrl,
      autoStart: config.autoStartAgent,
      projectRoot: config.projectRoot,
      logPath: config.agentLogPath,
      onStatus: (message) => console.error(`  ${message}`),
    });
    console.log(
      await runTelegramCommand(command, {
        agentUrl: config.agentUrl,
        accessToken: clerk.accessToken,
      }),
    );
    return;
  }
  await ensureBeeAgent({
    agentUrl: config.agentUrl,
    autoStart: config.autoStartAgent,
    projectRoot: config.projectRoot,
    logPath: config.agentLogPath,
    onStatus: (message) => console.error(`  ${message}`),
  });
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
  async function ask(
    prompt: string,
    writeProgress: (line: string) => void = (line) =>
      console.error(`  ${line}`),
  ) {
    const progress = createTerminalProgress(writeProgress);
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

  await runBeeTui({
    history: await createPromptHistory(config.historyPath),
    ask: async (prompt, onProgress, onReply) => {
      const progress = createTerminalProgress(onProgress);
      let streamedStep = "";
      const raw = await session.ask(prompt, (event) => {
        progress(event);
        if (event.type === "message-started") {
          streamedStep = "";
          onReply({ type: "reset" });
        } else if (event.type === "message-delta" && event.kind === "text") {
          streamedStep += event.delta;
          onReply({
            type: "replace",
            text: projectStreamingBeeReply(streamedStep),
          });
        }
      });
      return projectBeeReply(raw) || "Bee finished without a text reply.";
    },
    newConversation: async () => {
      await session.newConversation();
    },
    friendlyError,
  });
}

try {
  await main();
} catch (error) {
  console.error(`Bee CLI: ${friendlyError(error)}`);
  process.exitCode = 1;
}
