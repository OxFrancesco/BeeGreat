// @ts-nocheck -- Bun test globals are intentionally outside the mobile bundle tsconfig.
import { describe, expect, test } from 'bun:test';

import { resolveAppleAuthenticationAvailability } from './apple-auth-availability';

describe('resolveAppleAuthenticationAvailability', () => {
  test('keeps the native Apple button hidden when the module is unavailable', async () => {
    expect(
      await resolveAppleAuthenticationAvailability('ios', async () => false),
    ).toBe(false);
  });

  test('keeps the native Apple button hidden when availability probing fails', async () => {
    expect(
      await resolveAppleAuthenticationAvailability('ios', async () => {
        throw new Error('native module missing');
      }),
    ).toBe(false);
  });

  test('does not probe Apple authentication on another platform', async () => {
    let probed = false;

    expect(
      await resolveAppleAuthenticationAvailability('android', async () => {
        probed = true;
        return true;
      }),
    ).toBe(false);
    expect(probed).toBe(false);
  });
});
