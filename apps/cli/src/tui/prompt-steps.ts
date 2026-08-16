import type { SelectOption } from "@opentui/core";

import { scrubIdentifiers } from "@beegreat/tool-presentation";

import type { BeeQuestion } from "../reply";

export const CUSTOM_ANSWER = "__bee_custom_answer__";

export type PromptStep = {
  title: string;
  options: SelectOption[];
};

export type ActivePrompt = {
  kind: "question" | "confirm";
  steps: PromptStep[];
  stepIndex: number;
  values: string[];
  displays: string[];
};

/** Builds sequential select steps with the shared global option numbering. */
export function questionPromptSteps(
  question: BeeQuestion,
): PromptStep[] | undefined {
  if (question.questions.some((prompt) => !prompt.options?.length)) {
    return undefined;
  }
  let optionNumber = 0;
  return question.questions.map((prompt) => ({
    title: `${scrubIdentifiers(prompt.header)} — ${scrubIdentifiers(prompt.question)}`,
    options: [
      ...(prompt.options ?? []).map((option) => {
        optionNumber += 1;
        return {
          name: scrubIdentifiers(option.label),
          description: option.description
            ? scrubIdentifiers(option.description)
            : "",
          value: String(optionNumber),
        };
      }),
      {
        name: "Type something else",
        description: "Answer in your own words",
        value: CUSTOM_ANSWER,
      },
    ],
  }));
}

export function confirmPromptSteps(summary: string): PromptStep[] {
  return [
    {
      title: summary,
      options: [
        {
          name: "Yes",
          description: "Authorize this exact action",
          value: "yes",
        },
        { name: "No", description: "Cancel it", value: "no" },
      ],
    },
  ];
}
