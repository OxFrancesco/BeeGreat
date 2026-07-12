// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { expect, test } from 'bun:test';

import { updateGoogleHealthPowerup } from './google-health-powerup';

test('enabling Google Health turns on the power-up before opening OAuth', async () => {
  const events: string[] = [];

  await updateGoogleHealthPowerup(true, {
    connect: async () => {
      events.push('connect');
      return true;
    },
    disconnect: async () => events.push('disconnect'),
    setEnabled: async (enabled) => events.push(`enabled:${enabled}`),
  });

  expect(events).toEqual(['enabled:true', 'connect']);
});

test('cancelled Google Health OAuth rolls the power-up back off', async () => {
  const events: string[] = [];

  const connected = await updateGoogleHealthPowerup(true, {
    connect: async () => {
      events.push('connect');
      return false;
    },
    disconnect: async () => events.push('disconnect'),
    setEnabled: async (enabled) => events.push(`enabled:${enabled}`),
  });

  expect(connected).toBe(false);
  expect(events).toEqual(['enabled:true', 'connect', 'enabled:false']);
});
