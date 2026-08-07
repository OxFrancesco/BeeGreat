import { scrubIdentifiers } from "@beegreat/tool-presentation";

type JsonObject = Record<string, unknown>;

export type FirstFocusConfirmation = {
  requestId: string;
  goalTitle: string;
  projectTitle: string;
  taskTitle: string;
};

export type Web3Confirmation = {
  actionId: string;
  summary: string;
};

export type BeeReply = {
  text: string;
  firstFocus?: FirstFocusConfirmation;
  web3Confirmation?: Web3Confirmation;
};

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? scrubIdentifiers(value) : "";
}

function renderComponent(value: unknown): string {
  const component = object(value);
  if (!component || typeof component.type !== "string") return "";

  switch (component.type) {
    case "text":
      return text(component.body);
    case "metric": {
      const label = text(component.label);
      const metricValue = text(component.value);
      const delta = text(component.delta);
      return [label && `${label}: ${metricValue}`, delta]
        .filter(Boolean)
        .join(" — ");
    }
    case "chart": {
      const title = text(component.title);
      const unit = text(component.unit);
      const rows = Array.isArray(component.data)
        ? component.data.flatMap((entry) => {
            const row = object(entry);
            if (!row) return [];
            const label = text(row.label);
            const number =
              typeof row.value === "number" ? String(row.value) : "";
            return label && number
              ? [`${label}: ${number}${unit ? ` ${unit}` : ""}`]
              : [];
          })
        : [];
      return [title, ...rows].filter(Boolean).join("\n");
    }
    case "tasks": {
      const title = text(component.title);
      const items = Array.isArray(component.items)
        ? component.items.flatMap((entry) => {
            const item = object(entry);
            if (!item) return [];
            const itemTitle = text(item.title);
            if (!itemTitle) return [];
            const due = text(item.due);
            return [
              `[${item.done === true ? "x" : " "}] ${itemTitle}${due ? ` — ${due}` : ""}`,
            ];
          })
        : [];
      return [title, ...items].filter(Boolean).join("\n");
    }
    case "highlight":
      return [text(component.title), text(component.body)]
        .filter(Boolean)
        .join("\n");
    case "image":
      return [text(component.title) || text(component.alt), text(component.url)]
        .filter(Boolean)
        .join("\n");
    case "bookmark":
      return [text(component.title), text(component.note), text(component.url)]
        .filter(Boolean)
        .join("\n");
    case "devin":
      return [
        text(component.title),
        text(component.status),
        text(component.statusDetail),
        text(component.summary),
      ]
        .filter(Boolean)
        .join("\n");
    case "first_focus":
      return [
        "Your first focus",
        `Goal: ${text(component.goalTitle)}`,
        `Project: ${text(component.projectTitle)}`,
        `Task: ${text(component.taskTitle)}`,
        "Reply yes to create it or no to cancel.",
      ].join("\n");
    case "confirm":
      return [
        "Needs your confirmation",
        text(component.summary),
        "Reply yes to continue or no to cancel.",
      ]
        .filter(Boolean)
        .join("\n");
    default:
      return "";
  }
}

function renderBeeUi(
  json: string,
): Omit<BeeReply, "text"> & { rendered: string } {
  try {
    const payload = object(JSON.parse(json));
    if (!payload || !Array.isArray(payload.components)) return { rendered: "" };
    let firstFocus: FirstFocusConfirmation | undefined;
    let web3Confirmation: Web3Confirmation | undefined;
    for (const value of payload.components) {
      const component = object(value);
      if (!component) continue;
      if (
        component.type === "first_focus" &&
        typeof component.requestId === "string" &&
        typeof component.goalTitle === "string" &&
        typeof component.projectTitle === "string" &&
        typeof component.taskTitle === "string"
      ) {
        firstFocus = {
          requestId: component.requestId,
          goalTitle: component.goalTitle,
          projectTitle: component.projectTitle,
          taskTitle: component.taskTitle,
        };
      }
      const payload = object(component.payload);
      if (
        component.type === "confirm" &&
        component.action === "web3" &&
        typeof component.summary === "string" &&
        payload &&
        typeof payload.web3ActionId === "string"
      ) {
        web3Confirmation = {
          actionId: payload.web3ActionId,
          summary: component.summary,
        };
      }
    }
    const rendered = payload.components
      .map(renderComponent)
      .filter(Boolean)
      .join("\n\n");
    return {
      rendered,
      ...(firstFocus ? { firstFocus } : {}),
      ...(web3Confirmation ? { web3Confirmation } : {}),
    };
  } catch {
    return { rendered: "" };
  }
}

/** Parses guarded action data while projecting only safe copy to the terminal. */
export function parseBeeReply(raw: string): BeeReply {
  const cards: string[] = [];
  let firstFocus: FirstFocusConfirmation | undefined;
  let web3Confirmation: Web3Confirmation | undefined;
  const spoken = raw.replace(
    /```beeui\s*([\s\S]*?)```/gi,
    (_block, json: string) => {
      const parsed = renderBeeUi(json.trim());
      if (parsed.rendered) cards.push(parsed.rendered);
      firstFocus = parsed.firstFocus ?? firstFocus;
      web3Confirmation = parsed.web3Confirmation ?? web3Confirmation;
      return "";
    },
  );
  const projected = [scrubIdentifiers(spoken), ...cards]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    text: projected,
    ...(firstFocus ? { firstFocus } : {}),
    ...(web3Confirmation ? { web3Confirmation } : {}),
  };
}

/** Projects Bee's spoken + generated-UI contract into safe terminal text. */
export function projectBeeReply(raw: string): string {
  return parseBeeReply(raw).text;
}

/** Projects only complete spoken text while a beeui fence is still streaming. */
export function projectStreamingBeeReply(raw: string): string {
  const fence = raw.search(/```beeui/i);
  return projectBeeReply(fence === -1 ? raw : raw.slice(0, fence));
}
