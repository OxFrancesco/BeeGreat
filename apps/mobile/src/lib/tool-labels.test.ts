// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import { getToolCopy } from './tool-labels';

describe('specialist tool labels', () => {
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
    expect(getToolCopy('task', 'running', { agent: 'imagine' }).specialist).toBe(
      'Imagine',
    );
    expect(
      getToolCopy('task', 'running', { agent: 'google-workspace' }).specialist,
    ).toBe('Google Workspace');
    expect(getToolCopy('task', 'running', { agent: 'imagine' }).powerup).toBeNull();
  });

  test('labels Devin session activity', () => {
    expect(getToolCopy('start_devin_task', 'running').powerup).toBe('Devin');
    expect(getToolCopy('follow_up_devin_task', 'done').label).toBe(
      'Sent Devin the follow-up',
    );
  });

  test('labels FAL media activity without exposing tool names', () => {
    expect(getToolCopy('generate_image', 'running')).toMatchObject({
      label: 'Creating your image…',
      specialist: 'Imagine',
      powerup: null,
      symbol: 'wand.and.stars',
    });
    expect(getToolCopy('edit_video', 'done')).toMatchObject({
      label: 'Edited your video',
      specialist: 'Imagine',
      powerup: null,
      symbol: 'film',
    });
  });
});
describe('Mind tool labels', () => {
  test('presents bookmark mutations as first-class Bee activity', () => {
    expect(getToolCopy('update_bookmark', 'done')).toMatchObject({
      label: 'Updated the bookmark',
      symbol: 'pencil',
    });
    expect(getToolCopy('delete_bookmark', 'running')).toMatchObject({
      label: 'Deleting the bookmark…',
      symbol: 'trash',
    });
  });
});
