import { defineTool } from '@flue/runtime'
import * as v from 'valibot'

const questionOptionSchema = v.object({
  label: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(40),
    v.description('Short answer label'),
  ),
  description: v.optional(
    v.pipe(
      v.string(),
      v.minLength(1),
      v.maxLength(120),
      v.description('One short sentence explaining the choice'),
    ),
  ),
})

const questionPromptSchema = v.object({
  header: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(24),
    v.description('Compact topic label, not a sentence'),
  ),
  question: v.pipe(
    v.string(),
    v.minLength(1),
    v.maxLength(180),
    v.description('One direct question for the user'),
  ),
  options: v.optional(
    v.pipe(
      v.array(questionOptionSchema),
      v.minLength(2),
      v.maxLength(3),
      v.description('Two or three mutually exclusive choices when useful'),
    ),
  ),
})

export const questionInputSchema = v.object({
  questions: v.pipe(
    v.array(questionPromptSchema),
    v.minLength(1),
    v.maxLength(3),
    v.description('One to three essential questions'),
  ),
})

export function createQuestionTool() {
  return defineTool({
    name: 'question',
    description:
      'Ask the user for essential missing information before continuing. Use one to three short questions. Include two or three options when the choice is constrained; the user can always type a custom answer. After this tool returns, render its exact question component in one beeui block and end the response. The next user reply resumes the same conversation.',
    input: questionInputSchema,
    async run({ data }) {
      return {
        output: {
          component: { type: 'question' as const, questions: data.questions },
          instruction:
            'Render this exact question component in the beeui block and end the response. Continue after the user replies.',
        },
      }
    },
  })
}
