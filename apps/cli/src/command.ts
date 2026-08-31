export type BeeCommand =
  | { kind: "ask"; prompt: string }
  | { kind: "chat" }
  | { kind: "new" }
  | { kind: "login" }
  | { kind: "logout" }
  | {
      kind: "telegram";
      action: "connect" | "status" | "disconnect" | "notify";
      message?: string;
    }
  | {
      kind: "imessage";
      action: "status" | "disconnect";
      address?: string;
    }
  | { kind: "buddytg"; args: string[] }
  | { kind: "help" };

export function parseCommand(args: string[]): BeeCommand {
  const [command, ...rest] = args;
  if (!command || command === "chat") return { kind: "chat" };
  if (command === "new") return { kind: "new" };
  if (command === "login") return { kind: "login" };
  if (command === "logout") return { kind: "logout" };
  if (command === "buddytg") return { kind: "buddytg", args: rest };
  if (command === "telegram") {
    const [action = "connect", ...telegramArgs] = rest;
    if (
      action !== "connect" &&
      action !== "status" &&
      action !== "disconnect" &&
      action !== "notify"
    ) {
      throw new Error(
        "Use `bee telegram connect|status|disconnect|notify <message>`."
      );
    }
    if (action === "notify") {
      const message = telegramArgs.join(" ").trim();
      if (!message) throw new Error("Tell Bee what to send to Telegram.");
      return { kind: "telegram", action, message };
    }
    if (telegramArgs.length) {
      throw new Error(`\`bee telegram ${action}\` does not accept arguments.`);
    }
    return { kind: "telegram", action };
  }
  if (command === "imessage") {
    const [action = "status", ...imessageArgs] = rest;
    if (action !== "status" && action !== "disconnect") {
      throw new Error(
        "Use `bee imessage status|disconnect [address]`."
      );
    }
    if (action === "status" && imessageArgs.length) {
      throw new Error("`bee imessage status` does not accept arguments.");
    }
    if (imessageArgs.length > 1) {
      throw new Error(
        "`bee imessage disconnect` accepts at most one address."
      );
    }
    const address = imessageArgs[0]?.trim();
    if (address) return { kind: "imessage", action, address };
    return { kind: "imessage", action };
  }
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
