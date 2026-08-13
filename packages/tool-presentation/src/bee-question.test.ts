import { describe, expect, test } from "bun:test";

import {
  parseBeeQuestion,
  renderBeeQuestion,
  resolveBeeQuestionAnswer,
} from "./bee-question";

describe("text-channel questions", () => {
  test("renders bounded global choices and resolves one answer per question", () => {
    const question = parseBeeQuestion({
      type: "question",
      questions: [
        {
          header: "Network",
          question: "Which network?",
          options: [{ label: "Base" }, { label: "Arbitrum" }],
        },
        {
          header: "Speed",
          question: "Which speed?",
          options: [{ label: "Fast" }, { label: "Careful" }],
        },
      ],
    });

    expect(renderBeeQuestion(question!)).toContain("[4] Careful");
    expect(resolveBeeQuestionAnswer(question, "1, 4")).toBe(
      "For “Which network?”, my answer is “Base”.\nFor “Which speed?”, my answer is “Careful”.",
    );
    expect(resolveBeeQuestionAnswer(question, "1")).toBe("1");
  });

  test("rejects malformed or unbounded choices", () => {
    expect(
      parseBeeQuestion({
        type: "question",
        questions: [
          {
            header: "Network",
            question: "Which network?",
            options: [{ label: "Base" }],
          },
        ],
      }),
    ).toBeUndefined();
  });
});
