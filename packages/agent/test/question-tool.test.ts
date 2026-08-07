import { describe, expect, test } from 'bun:test'
import * as v from 'valibot'
import {
  createQuestionTool,
  questionInputSchema,
} from '../src/shared/question-tool.ts'

describe('Bee question tool', () => {
  test('returns a validated question card for the current conversation', async () => {
    const input = {
      questions: [
        {
          header: 'Network',
          question: 'Which network should I use?',
          options: [
            { label: 'Base', description: 'Use the Base position.' },
            { label: 'Arbitrum', description: 'Use Arbitrum instead.' },
          ],
        },
      ],
    }

    expect(v.safeParse(questionInputSchema, input).success).toBe(true)
    const tool = createQuestionTool()
    expect(tool.name).toBe('question')
    await expect(tool.run({ data: input } as never)).resolves.toEqual({
      output: {
        component: { type: 'question', ...input },
        instruction:
          'Render this exact question component in the beeui block and end the response. Continue after the user replies.',
      },
    })
  })

  test('rejects more than three questions and option lists outside two to three choices', () => {
    const question = {
      header: 'Choice',
      question: 'What should Bee use?',
      options: [{ label: 'Only choice', description: 'Not a real choice.' }],
    }
    expect(
      v.safeParse(questionInputSchema, { questions: [question] }).success,
    ).toBe(false)
    expect(
      v.safeParse(questionInputSchema, {
        questions: [question, question, question, question],
      }).success,
    ).toBe(false)
  })
})
