import { z } from "zod";

import { scrubIdentifiers } from "./scrub-identifiers";

const questionOptionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  description: z.string().trim().min(1).max(120).optional(),
});

const questionPromptSchema = z.object({
  header: z.string().trim().min(1).max(24),
  question: z.string().trim().min(1).max(180),
  options: z.array(questionOptionSchema).min(2).max(3).optional(),
});

/** The bounded question contract shared by every channel. */
export const questionComponentSchema = z.object({
  type: z.literal("question"),
  questions: z.array(questionPromptSchema).min(1).max(3),
});

export type BeeQuestion = {
  questions: Array<{
    header: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }>;
};

/** Parses the bounded question contract shared by every text channel. */
export function parseBeeQuestion<Candidate>(
  value: Candidate,
): BeeQuestion | undefined {
  const parsed = questionComponentSchema.safeParse(value);
  return parsed.success ? { questions: parsed.data.questions } : undefined;
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
