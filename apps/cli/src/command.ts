export type BeeCommand =
  | { kind: "ask"; prompt: string }
  | { kind: "chat" }
  | { kind: "new" }
  | { kind: "login" }
  | { kind: "logout" }
  | { kind: "help" };

export function parseCommand(args: string[]): BeeCommand {
  const [command, ...rest] = args;
  if (!command || command === "chat") return { kind: "chat" };
  if (command === "new") return { kind: "new" };
  if (command === "login") return { kind: "login" };
  if (command === "logout") return { kind: "logout" };
  if (command === "help" || command === "--help" || command === "-h") {
    return { kind: "help" };
  }
  if (command === "ask") {
    const prompt = rest.join(" ").trim();
    if (!prompt) throw new Error("Tell Bee what to do after `bee ask`.");
    return { kind: "ask", prompt };
  }
  return { kind: "ask", prompt: args.join(" ") };
}
