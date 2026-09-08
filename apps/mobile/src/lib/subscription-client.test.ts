// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { expect, mock, test } from 'bun:test';
let userId = 'user_lease';
const info = { entitlements: { active: {}, verification: 'VERIFIED' }, managementURL: null };
const listeners = new Set<(value: typeof info) => void>();
mock.module('react-native-purchases', () => ({
  PURCHASES_ERROR_CODE: { NETWORK_ERROR: 'network' },
  default: {
    isConfigured: async () => true,
    getAppUserID: async () => userId,
    isAnonymous: async () => false,
    logIn: async (next: string) => { userId = next },
    getCustomerInfo: async () => info,
    getOfferings: async () => ({ current: null }),
    addCustomerInfoUpdateListener: (fn: (value: typeof info) => void) => listeners.add(fn),
    removeCustomerInfoUpdateListener: (fn: (value: typeof info) => void) => listeners.delete(fn),
  },
}));
const { subscriptionClient } = await import('./subscription-client');
test('an older same-user cleanup and subscription cannot affect the replacement lease', async () => {
  const priorOs = process.env.EXPO_OS;
  process.env.EXPO_OS = 'ios';
  try {
    const older = Symbol('older');
    const newer = Symbol('newer');
    await subscriptionClient.connect({ appUserId: userId, apiKey: 'fixture', leaseId: older });
    let oldUpdates = 0;
    let newUpdates = 0;
    const stopOld = subscriptionClient.subscribe(userId, () => oldUpdates++, older);
    await subscriptionClient.connect({ appUserId: userId, apiKey: 'fixture', leaseId: newer });
    const stopNew = subscriptionClient.subscribe(userId, () => newUpdates++, newer);
    subscriptionClient.disconnect(userId, older);
    await expect(subscriptionClient.refresh()).resolves.toMatchObject({ isPro: false });
    for (const listener of listeners) listener(info);
    expect(oldUpdates).toBe(0);
    expect(newUpdates).toBe(1);
    stopOld(); stopNew();
    subscriptionClient.disconnect(userId, newer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(() => subscriptionClient.refresh()).toThrow();
  } finally {
    if (priorOs === undefined) delete process.env.EXPO_OS;
    else process.env.EXPO_OS = priorOs;
  }
});
