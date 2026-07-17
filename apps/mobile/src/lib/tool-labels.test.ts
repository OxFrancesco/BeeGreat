// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import { getToolCopy } from './tool-labels';

describe('power-up tool labels', () => {
  test('separates the specialist identity from its completion status', () => {
    const copy = getToolCopy('task', 'done', { agent: 'google-health' });

    expect(copy.powerup).toBe('Google Health');
    expect(copy.label).toBe('Finished');
    expect(copy.label).not.toContain(copy.powerup!);
  });

  test('keeps distinct specialist identities for palette selection', () => {
    expect(getToolCopy('task', 'running', { agent: 'google-health' }).powerup).toBe(
      'Google Health',
    );
    expect(getToolCopy('task', 'running', { agent: 'web3' }).powerup).toBe('Web3');
    expect(getToolCopy('task', 'running', { agent: 'devin' }).powerup).toBe('Devin');
  });

  test('labels Devin session activity', () => {
    expect(getToolCopy('start_devin_task', 'running').powerup).toBe('Devin');
    expect(getToolCopy('follow_up_devin_task', 'done').label).toBe(
      'Sent Devin the follow-up',
    );
  });
});
