// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import { BEE_AGENT_LIVE_MODE, resolveBeeAgentLiveMode } from './flue-transport';

describe('Bee Flue transport', () => {
  test('uses SSE for incremental live conversation updates', () => {
    expect(BEE_AGENT_LIVE_MODE).toBe('sse');
    expect(resolveBeeAgentLiveMode()).toBe('sse');
  });

  test('keeps long-poll as an explicit rollback mode', () => {
    expect(resolveBeeAgentLiveMode('long-poll')).toBe('long-poll');
    expect(resolveBeeAgentLiveMode('unexpected')).toBe('sse');
  });
});
