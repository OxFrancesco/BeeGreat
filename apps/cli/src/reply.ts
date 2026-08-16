import {
  BEEUI_FENCE_OPEN,
  deriveBeeUiFollowUps,
  extractBeeUi,
  humanizeWeb3Summary,
  renderBeeUiMarkdown,
  resolveBeeQuestionAnswer,
  type BeeQuestion,
  type FirstFocusPreview,
  type Web3Confirmation,
} from "@beegreat/tool-presentation";

export type {
  BeeQuestion,
  FirstFocusPreview,
  Web3Confirmation,
} from "@beegreat/tool-presentation";

/** Structured follow-up the terminal can answer with an interactive prompt. */
export type BeeFollowUp =
  | { kind: "question"; question: BeeQuestion }
  | { kind: "confirm"; summary: string };

export type BeeReply = {
  text: string;
  firstFocus?: FirstFocusPreview;
  web3Confirmation?: Web3Confirmation;
  confirmation?: { summary: string };
  question?: BeeQuestion;
};

/** Parses guarded action data while projecting only safe copy to the terminal. */
export function parseBeeReply(raw: string): BeeReply {
  const { spoken, components } = extractBeeUi(raw);
  const cards = components.map((component) => {
    const { markdown, links } = renderBeeUiMarkdown(component);
    return [markdown, ...links].filter(Boolean).join("\n");
  });
  const text = [spoken, ...cards]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
  return { text, ...deriveBeeUiFollowUps(components) };
}

/** The one prompt the TUI should raise for a reply, in blocking-priority order. */
export function deriveFollowUp(reply: BeeReply): BeeFollowUp | undefined {
  if (reply.firstFocus) {
    return { kind: "confirm", summary: "Create this first-focus plan?" };
  }
  if (reply.web3Confirmation) {
    return {
      kind: "confirm",
      summary: humanizeWeb3Summary(reply.web3Confirmation.summary),
    };
  }
  if (reply.confirmation) {
    return { kind: "confirm", summary: reply.confirmation.summary };
  }
  if (reply.question) {
    return { kind: "question", question: reply.question };
  }
  return undefined;
}

/** Maps a terminal option number back to a natural same-thread user answer. */
export function resolveQuestionAnswer(
  question: BeeQuestion | undefined,
  answer: string,
): string {
  return resolveBeeQuestionAnswer(question, answer);
}

/** Projects Bee's spoken + generated-UI contract into safe terminal text. */
export function projectBeeReply(raw: string): string {
  return parseBeeReply(raw).text;
}

/** Projects only complete spoken text while a beeui fence is still streaming. */
export function projectStreamingBeeReply(raw: string): string {
  const fence = raw.search(BEEUI_FENCE_OPEN);
  return projectBeeReply(fence === -1 ? raw : raw.slice(0, fence));
}
