import { scrubIdentifiers } from "./scrub-identifiers";

export type TextWeb3Action = {
  summary: string;
  kind?: "send_tokens" | "execute_plan" | "execute_eoa_plan" | "socket_swap";
  status:
    | "pending"
    | "confirmed"
    | "in_progress"
    | "executed"
    | "failed"
    | "refunded"
    | "cancelled"
    | "expired";
  autoConfirmed: boolean;
  error?: string | null;
  result?: Array<{ hash: string | null; explorerLink: string | null }> | null;
  socketProgress?: {
    detail: string;
    destinationExplorerLink?: string;
  } | null;
  timing?: { estimatedTimeSeconds: number } | null;
};

export type TextWeb3Projection = {
  text: string;
  links: string[];
  requiresTextConfirmation: boolean;
};

const WEB_APP_URL = "https://beegreat.app";
const EVM_ADDRESS = /0x[0-9a-fA-F]{40}/g;

/** Keeps machine addresses out of ordinary channel copy while retaining meaning. */
export function humanizeWeb3Summary(summary: string): string {
  return scrubIdentifiers(summary)
    .replace(/\bpool\s+0x[0-9a-fA-F]{40}\b/gi, "the selected pool")
    .replace(/\bwallet\s+0x[0-9a-fA-F]{40}\b/gi, "your wallet")
    .replace(EVM_ADDRESS, "the selected address")
    .replace(/\s*:\s*(the selected pool|your wallet)\b/g, " · $1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function explorerLinks(action: TextWeb3Action) {
  const destination = action.socketProgress?.destinationExplorerLink;
  const final = [...(action.result ?? [])]
    .reverse()
    .find((item) => item.explorerLink)?.explorerLink;
  return [
    ...new Set(
      [destination, final].filter((link): link is string => Boolean(link)),
    ),
  ];
}

/** Canonical state-to-copy reducer shared by iMessage and the CLI. */
export function projectTextWeb3Action(
  action: TextWeb3Action,
): TextWeb3Projection {
  const summary = humanizeWeb3Summary(action.summary);
  const links = explorerLinks(action);

  if (action.status === "pending") {
    if (action.kind === "execute_eoa_plan") {
      return {
        text: [
          "Open BeeGreat to sign",
          summary,
          "This linked-wallet action must be reviewed and signed in BeeGreat. A reply here cannot authorize it.",
        ].join("\n"),
        links: [WEB_APP_URL],
        requiresTextConfirmation: false,
      };
    }
    return {
      text: [
        "Needs your confirmation",
        summary,
        "Reply yes to authorize this exact action or no to cancel it.",
      ].join("\n"),
      links,
      requiresTextConfirmation: true,
    };
  }

  if (action.status === "confirmed" || action.status === "in_progress") {
    const title = action.autoConfirmed
      ? "Auto-approved · YOLO mode"
      : "Web3 action in progress";
    const eta =
      action.timing && action.timing.estimatedTimeSeconds > 0
        ? `Estimated time: about ${Math.max(1, Math.ceil(action.timing.estimatedTimeSeconds / 60))} min.`
        : undefined;
    return {
      text: [
        title,
        summary,
        action.socketProgress?.detail ?? "Execution has started.",
        eta,
      ]
        .filter(Boolean)
        .join("\n"),
      links,
      requiresTextConfirmation: false,
    };
  }

  const titles = {
    executed: "Web3 action complete",
    failed: "Web3 action failed",
    refunded: "Web3 action refunded",
    cancelled: "Web3 action cancelled",
    expired: "Web3 confirmation expired",
  } satisfies Record<
    Exclude<TextWeb3Action["status"], "pending" | "confirmed" | "in_progress">,
    string
  >;
  return {
    text: [
      titles[action.status],
      summary,
      action.socketProgress?.detail,
      action.status === "failed" && action.error
        ? scrubIdentifiers(action.error)
        : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
    links,
    requiresTextConfirmation: false,
  };
}
