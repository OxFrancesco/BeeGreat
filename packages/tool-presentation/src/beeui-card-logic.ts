// Pure helpers behind the rich beeui cards. Web and mobile render the cards
// with their own components (DOM vs React Native), but the logic that shapes
// what users read and send back must live here so the platforms cannot drift.

/** Echoes a question-card choice back to Bee as a normal chat message. */
export function questionAnswer(question: string, answer: string): string {
  return `For “${question}”, my answer is “${answer}”.`;
}

/** Hostname without the `www.` prefix; falls back to the raw URL text. */
export function bookmarkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Suggested file name when copying, saving, or downloading a generated image. */
export function generatedImageFileName(url: string): string {
  try {
    const sourceName = new URL(url).pathname.split("/").pop() ?? "";
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(sourceName)) {
      return sourceName;
    }
  } catch {
    // The schema already validates generated URLs; keep a safe filename
    // fallback in case a platform's URL parsing still throws.
  }
  return `bee-image-${Date.now()}.png`;
}

export type EoaFailureReason =
  | "user_rejected"
  | "account_changed"
  | "wallet_error";

/**
 * Classifies why a linked-wallet (EOA) signing flow stopped so the backend
 * can record the precise outcome. EIP-1193 code 4001 is the user declining.
 */
export function eoaFailureReason(cause: unknown): EoaFailureReason {
  if (cause instanceof Object && "code" in cause && cause.code === 4001) {
    return "user_rejected";
  }
  if (
    cause instanceof Error &&
    cause.message.toLowerCase().includes("connect the wallet shown")
  ) {
    return "account_changed";
  }
  return "wallet_error";
}
