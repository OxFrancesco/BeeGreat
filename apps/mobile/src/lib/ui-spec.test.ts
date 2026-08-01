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
});
