import { scrubIdentifiers } from "./scrub-identifiers";

type JsonObject = Record<string, unknown>;

export type BeeQuestion = {
  questions: Array<{
    header: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }>;
};

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength
    ? trimmed
    : undefined;
}

/** Parses the bounded question contract shared by every text channel. */
export function parseBeeQuestion(value: unknown): BeeQuestion | undefined {
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
        if (
          !option ||
          !label ||
          (option.description !== undefined && !description)
        ) {
          return undefined;
        }
        options.push({ label, ...(description ? { description } : {}) });
      }
    }
    questions.push({ header, question, ...(options ? { options } : {}) });
  }
  return { questions };
}

/** Renders stable global option numbers so a short reply can be resolved. */
export function renderBeeQuestion(question: BeeQuestion): string {
  let optionNumber = 0;
  const questions = question.questions.map((prompt) => {
    const options = (prompt.options ?? []).map((option) => {
      optionNumber += 1;
      return `[${optionNumber}] ${scrubIdentifiers(option.label)}${
        option.description ? ` — ${scrubIdentifiers(option.description)}` : ""
      }`;
    });
    return [
      `${scrubIdentifiers(prompt.header)} — ${scrubIdentifiers(prompt.question)}`,
      ...options,
    ].join("\n");
  });

  return [
    ...questions,
    optionNumber
      ? question.questions.length > 1
        ? "Reply with one number per question (for example: 1, 4), or type your own answer."
        : "Reply with a number or type your own answer."
      : "Type your answer below.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Maps numbered choices back to an explicit same-thread natural-language answer. */
export function resolveBeeQuestionAnswer(
  question: BeeQuestion | undefined,
  answer: string,
): string {
  if (!question) return answer;
  const indices = answer
    .split(",")
    .map((value) => /^\s*\[?(\d+)\]?\s*$/.exec(value)?.[1]);
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
