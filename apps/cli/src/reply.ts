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

export type BeeQuestion = {
  questions: Array<{
    header: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }>;
};

export type BeeReply = {
  text: string;
  firstFocus?: FirstFocusConfirmation;
  web3Confirmation?: Web3Confirmation;
  question?: BeeQuestion;
};

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function text(value: unknown) {
  return typeof value === "string" ? scrubIdentifiers(value) : "";
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength
    ? trimmed
    : undefined;
}

function parseQuestionComponent(value: unknown): BeeQuestion | undefined {
  const component = object(value);
  if (
    component?.type !== "question" ||
    !Array.isArray(component.questions) ||
    component.questions.length < 1 ||
    component.questions.length > 3
  ) {
    return undefined;
  }
  const questions: BeeQuestion["questions"] = [];
  for (const value of component.questions) {
    const prompt = object(value);
    const header = boundedText(prompt?.header, 24);
    const question = boundedText(prompt?.question, 180);
    if (!prompt || !header || !question) return undefined;
    let options: BeeQuestion["questions"][number]["options"];
    if (prompt.options !== undefined) {
      if (
        !Array.isArray(prompt.options) ||
        prompt.options.length < 2 ||
        prompt.options.length > 3
      ) {
        return undefined;
      }
      options = [];
      for (const value of prompt.options) {
        const option = object(value);
        const label = boundedText(option?.label, 40);
        const description =
          option?.description === undefined
            ? undefined
            : boundedText(option.description, 120);
        if (!option || !label || (option.description !== undefined && !description)) {
          return undefined;
        }
        options.push({ label, ...(description ? { description } : {}) });
      }
    }
    questions.push({ header, question, ...(options ? { options } : {}) });
  }
  return { questions };
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
    case "question": {
      const parsed = parseQuestionComponent(component);
      if (!parsed) return "";
      let optionNumber = 0;
      const questions = parsed.questions.map((prompt) => {
        const options = prompt.options
          ? prompt.options.map((option) => {
              optionNumber += 1;
              return [
                `[${optionNumber}] ${text(option.label)}${option.description ? ` — ${text(option.description)}` : ""}`,
              ].join("");
            })
          : [];
        return [`${text(prompt.header)} — ${text(prompt.question)}`, ...options].join(
          "\n",
        );
      });
      return [
        ...questions,
        optionNumber
          ? parsed.questions.length > 1
            ? "Reply with one number per question (for example: 1, 4), or type your own answer."
            : "Reply with a number or type your own answer."
          : "Type your answer below.",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
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
    let question: BeeQuestion | undefined;
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
      question = parseQuestionComponent(component) ?? question;
    }
    const rendered = payload.components
      .map(renderComponent)
      .filter(Boolean)
      .join("\n\n");
    return {
      rendered,
      ...(firstFocus ? { firstFocus } : {}),
      ...(web3Confirmation ? { web3Confirmation } : {}),
      ...(question ? { question } : {}),
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
  let question: BeeQuestion | undefined;
  const spoken = raw.replace(
    /```beeui\s*([\s\S]*?)```/gi,
    (_block, json: string) => {
      const parsed = renderBeeUi(json.trim());
      if (parsed.rendered) cards.push(parsed.rendered);
      firstFocus = parsed.firstFocus ?? firstFocus;
      web3Confirmation = parsed.web3Confirmation ?? web3Confirmation;
      question = parsed.question ?? question;
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
    ...(question ? { question } : {}),
  };
}

/** Maps a terminal option number back to a natural same-thread user answer. */
export function resolveQuestionAnswer(
  question: BeeQuestion | undefined,
  answer: string,
): string {
  if (!question) return answer;
  const indices = answer.split(",").map((value) =>
    /^\s*\[?(\d+)\]?\s*$/.exec(value)?.[1],
  );
  if (indices.some((index) => !index)) return answer;
  const choices = question.questions.flatMap((prompt, promptIndex) =>
    (prompt.options ?? []).map((option) => ({ prompt, promptIndex, option })),
  );
  const selected = indices.map((index) => choices[Number(index) - 1]);
  if (
    selected.some((choice) => !choice) ||
    selected.length !== question.questions.length ||
    selected.some((choice, index) => choice?.promptIndex !== index)
  ) {
    return answer;
  }
  return selected
    .map(
      (choice) =>
        `For “${choice!.prompt.question}”, my answer is “${choice!.option.label}”.`,
    )
    .join("\n");
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
