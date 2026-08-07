// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import { extractBeeUI } from './ui-spec';

describe('extractBeeUI image output', () => {
  test('promotes a Markdown image into a native image card', () => {
    const result = extractBeeUI(
      'Done — here is your bee.\n\n![Cheerful bee](https://cdn.example.com/bee.png)',
    );

    expect(result).toEqual({
      spoken: 'Done — here is your bee.',
      components: [
        {
          type: 'image',
          url: 'https://cdn.example.com/bee.png',
          alt: 'Cheerful bee',
        },
      ],
    });
  });

  test('validates and scrubs a structured question card', () => {
    const result = extractBeeUI(`One detail first.
\`\`\`beeui
{"components":[{"type":"question","questions":[{"header":"Network","question":"Which network for request ID: request_123456789?","options":[{"label":"Base","description":"Use request ID: request_123456789."},{"label":"Arbitrum","description":"Use the other network."}]}]}]}
\`\`\``);

    expect(result).toEqual({
      spoken: 'One detail first.',
      components: [
        {
          type: 'question',
          questions: [
            {
              header: 'Network',
              question: 'Which network for?',
              options: [
                { label: 'Base', description: 'Use.' },
                { label: 'Arbitrum', description: 'Use the other network.' },
              ],
            },
          ],
        },
      ],
    });
  });
});
