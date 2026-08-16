import { z } from "zod";

import {
  questionComponentSchema,
  renderBeeQuestion,
  type BeeQuestion,
} from "./bee-question";
import { scrubIdentifiers } from "./scrub-identifiers";

// The single source of truth for Bee's generative-UI ("beeui") contract.
// Every client — web, mobile, CLI, iMessage — parses fenced beeui blocks
// through this module so the vocabulary can never drift between channels.

const httpsUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("https://"), "Expected an HTTPS URL");

export const firstFocusPreviewSchema = z.object({
  type: z.literal("first_focus"),
  requestId: z.string().min(1),
  goalTitle: z.string().min(1),
  projectTitle: z.string().min(1),
  taskTitle: z.string().min(1),
  seed: z.string().min(1).optional(),
  highlightExpiresAt: z.number().finite().optional(),
});

export type FirstFocusPreview = z.infer<typeof firstFocusPreviewSchema>;

export const uiComponentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string() }),
  z.object({
    type: z.literal("metric"),
    label: z.string(),
    value: z.string(),
    delta: z.string().optional(),
  }),
  z.object({
    type: z.literal("chart"),
    kind: z.literal("bar"),
    title: z.string(),
    unit: z.string().optional(),
    data: z.array(z.object({ label: z.string(), value: z.number() })).min(1),
  }),
  z.object({
    type: z.literal("tasks"),
    title: z.string(),
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        done: z.boolean(),
        due: z.string().optional(),
      }),
    ),
  }),
  z.object({
    type: z.literal("highlight"),
    title: z.string(),
    body: z.string(),
  }),
  z.object({
    type: z.literal("image"),
    url: httpsUrlSchema,
    alt: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal("bookmark"),
    title: z.string(),
    url: httpsUrlSchema,
    kind: z.enum(["website", "tweet", "youtube"]).optional(),
    labels: z.array(z.string()).max(8).optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("devin"),
    title: z.string(),
    status: z.string(),
    statusDetail: z.string().optional(),
    sessionId: z.string().regex(/^devin-[A-Za-z0-9_-]+$/),
    sessionUrl: httpsUrlSchema,
    summary: z.string().optional(),
    pullRequests: z
      .array(z.object({ url: httpsUrlSchema, state: z.string().optional() }))
      .max(20),
  }),
  firstFocusPreviewSchema,
  z.object({
    type: z.literal("confirm"),
    summary: z.string(),
    action: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
  questionComponentSchema,
]);

export type UIComponent = z.infer<typeof uiComponentSchema>;

/** A component type this client build does not know; degrade, never leak JSON. */
export type UnsupportedComponent = { type: "unsupported" };

export type ParsedBeeUiComponent = UIComponent | UnsupportedComponent;

const KNOWN_COMPONENT_TYPES = new Set<string>(
  uiComponentSchema.options.map((option) => option.shape.type.value),
);

/** Matches an opening beeui fence, e.g. to hide a block that is still streaming. */
export const BEEUI_FENCE_OPEN = /```beeui/i;

const beeUiFence = () => /```beeui\s*([\s\S]*?)```/gi;
const markdownImage = () =>
  /!\[([^\]]*)\]\((https:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\)/g;

/** Machine ids belong in structured fields, never in copy the user reads. */
function scrubComponent(component: UIComponent): UIComponent {
  switch (component.type) {
    case "text":
      return { ...component, body: scrubIdentifiers(component.body) };
    case "metric":
      return {
        ...component,
        label: scrubIdentifiers(component.label),
        value: scrubIdentifiers(component.value),
        delta: component.delta
          ? scrubIdentifiers(component.delta)
          : component.delta,
      };
    case "chart":
    case "tasks":
      return { ...component, title: scrubIdentifiers(component.title) };
    case "highlight":
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        body: scrubIdentifiers(component.body),
      };
    case "image":
      return {
        ...component,
        alt: scrubIdentifiers(component.alt),
        title: component.title
          ? scrubIdentifiers(component.title)
          : component.title,
      };
    case "devin":
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        summary: component.summary
          ? scrubIdentifiers(component.summary)
          : component.summary,
      };
    case "bookmark":
      return {
        ...component,
        title: scrubIdentifiers(component.title),
        note: component.note ? scrubIdentifiers(component.note) : component.note,
      };
    case "confirm":
      return { ...component, summary: scrubIdentifiers(component.summary) };
    case "question":
      return {
        ...component,
        questions: component.questions.map((question) => ({
          ...question,
          header: scrubIdentifiers(question.header),
          question: scrubIdentifiers(question.question),
          options: question.options?.map((option) => ({
            ...option,
            label: scrubIdentifiers(option.label),
            description: option.description
              ? scrubIdentifiers(option.description)
              : option.description,
          })),
        })),
      };
    default:
      return component;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Parses one fenced beeui JSON payload. Component types this build does not
 * know degrade to an "unsupported" card so newer agent vocabulary never
 * silently disappears; an invalid *known* component drops the entire block so
 * a malformed generated payload can never leak raw JSON into the chat.
 */
export function parseBeeUiBlock(json: string): ParsedBeeUiComponent[] {
  try {
    const payload = record(JSON.parse(json));
    if (!payload || !Array.isArray(payload.components)) return [];
    const components: ParsedBeeUiComponent[] = [];
    for (const value of payload.components) {
      const type = record(value)?.type;
      if (typeof type !== "string") return [];
      if (!KNOWN_COMPONENT_TYPES.has(type)) {
        components.push({ type: "unsupported" });
        continue;
      }
      const parsed = uiComponentSchema.safeParse(value);
      if (!parsed.success) return [];
      components.push(scrubComponent(parsed.data));
    }
    return components;
  } catch {
    return [];
  }
}

/**
 * Splits Bee's reply into conversational copy and validated UI components.
 * Specialists may return Markdown images directly; those are promoted into
 * image cards so every channel can make its own rendering decision.
 */
export function extractBeeUi(text: string): {
  spoken: string;
  components: ParsedBeeUiComponent[];
} {
  const components: ParsedBeeUiComponent[] = [];
  const spoken = text
    .replace(beeUiFence(), (_match, json: string) => {
      components.push(...parseBeeUiBlock(json.trim()));
      return "";
    })
    .replace(markdownImage(), (_match, alt: string, url: string) => {
      if (
        !components.some(
          (component) => component.type === "image" && component.url === url,
        )
      ) {
        components.push({
          type: "image",
          url,
          alt: alt.trim() || "Generated image",
        });
      }
      return "";
    })
    // Keep line breaks so markdown structure survives; just trim the excess.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { spoken: scrubIdentifiers(spoken), components };
}

export type Web3Confirmation = {
  actionId: string;
  summary: string;
};

export type BeeUiFollowUps = {
  firstFocus?: FirstFocusPreview;
  web3Confirmation?: Web3Confirmation;
  confirmation?: { summary: string };
  question?: BeeQuestion;
};

function web3ConfirmationOf(
  component: ParsedBeeUiComponent,
): Web3Confirmation | undefined {
  if (component.type !== "confirm") return undefined;
  const actionId = component.payload?.web3ActionId;
  return typeof actionId === "string" && actionId
    ? { actionId, summary: component.summary }
    : undefined;
}

/**
 * Derives the actionable follow-ups a text channel can answer in-thread.
 * A Web3 confirmation is only surfaced when the reply contains exactly one
 * action-bound confirm card — never guess which funds movement was meant.
 */
export function deriveBeeUiFollowUps(
  components: ParsedBeeUiComponent[],
): BeeUiFollowUps {
  const firstFocus = components.find(
    (component): component is FirstFocusPreview =>
      component.type === "first_focus",
  );
  const web3Confirmations = components
    .map(web3ConfirmationOf)
    .filter((confirmation): confirmation is Web3Confirmation =>
      Boolean(confirmation),
    );
  // The latest blocking decision wins: agent envelopes accumulate steps, so
  // earlier drafts must not compete with the final card.
  const reversed = [...components].reverse();
  const confirmation = reversed.find(
    (component): component is Extract<UIComponent, { type: "confirm" }> =>
      component.type === "confirm" && !web3ConfirmationOf(component),
  );
  const question = reversed.find(
    (component): component is Extract<UIComponent, { type: "question" }> =>
      component.type === "question",
  );
  return {
    ...(firstFocus ? { firstFocus } : {}),
    ...(web3Confirmations.length === 1
      ? { web3Confirmation: web3Confirmations[0] }
      : {}),
    ...(confirmation ? { confirmation: { summary: confirmation.summary } } : {}),
    ...(question ? { question: { questions: question.questions } } : {}),
  };
}

export type BeeUiMarkdown = {
  markdown: string;
  links: string[];
};

/**
 * Renders one component as channel-neutral Markdown for text channels
 * (CLI, iMessage). Rich clients render components natively instead.
 */
export function renderBeeUiMarkdown(
  component: ParsedBeeUiComponent,
): BeeUiMarkdown {
  switch (component.type) {
    case "text":
      return { markdown: component.body, links: [] };
    case "metric":
      return {
        markdown: `**${component.label}:** ${component.value}${
          component.delta ? ` — ${component.delta}` : ""
        }`,
        links: [],
      };
    case "chart":
      return {
        markdown: [
          `**${component.title}**`,
          ...component.data.map(
            (item) =>
              `${item.label}: ${item.value}${
                component.unit ? ` ${component.unit}` : ""
              }`,
          ),
        ].join("\n"),
        links: [],
      };
    case "tasks":
      return {
        markdown: [
          `**${component.title}**`,
          ...component.items.map(
            (item) =>
              `${item.done ? "☑" : "☐"} ${item.title}${
                item.due ? ` — ${item.due}` : ""
              }`,
          ),
          "Reply with the exact Task you want Bee to work with.",
        ].join("\n"),
        links: [],
      };
    case "highlight":
      return {
        markdown: `**${component.title}**\n${component.body}`,
        links: [],
      };
    case "image":
      return {
        markdown: component.title ? `**${component.title}**` : component.alt,
        links: [component.url],
      };
    case "bookmark":
      return {
        markdown: `**${component.title}**${
          component.note ? `\n${component.note}` : ""
        }`,
        links: [component.url],
      };
    case "devin":
      return {
        markdown: [
          `**${component.title}** — ${component.status}`,
          component.statusDetail ?? "",
          component.summary ?? "",
          ...component.pullRequests.map(
            (pullRequest) =>
              `Pull request${pullRequest.state ? ` — ${pullRequest.state}` : ""}`,
          ),
        ]
          .filter(Boolean)
          .join("\n"),
        links: [
          component.sessionUrl,
          ...component.pullRequests.map((pullRequest) => pullRequest.url),
        ],
      };
    case "first_focus":
      return {
        markdown: [
          "**Your first focus**",
          `Goal: ${component.goalTitle}`,
          `Project: ${component.projectTitle}`,
          `Task: ${component.taskTitle}`,
          "Reply **yes** to create it or **no** to cancel.",
        ].join("\n"),
        links: [],
      };
    case "confirm":
      return {
        markdown: [
          "**Needs your confirmation**",
          component.summary,
          web3ConfirmationOf(component)
            ? "Reply **yes** to authorize this exact action or **no** to cancel it."
            : "Reply **yes** to continue or **no** to cancel.",
        ].join("\n"),
        links: [],
      };
    case "question":
      return {
        markdown: renderBeeQuestion({ questions: component.questions }),
        links: [],
      };
    case "unsupported":
      return {
        markdown:
          "Bee shared an interactive card that can’t be displayed here. Open BeeGreat to continue.",
        links: ["https://beegreat.app"],
      };
  }
}
