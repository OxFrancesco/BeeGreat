// @ts-nocheck -- Bun test globals are intentionally outside the mobile bundle tsconfig.
import { describe, expect, test } from 'bun:test';

import { makeClerkSsoRedirectUrl } from './auth-redirect';

describe('makeClerkSsoRedirectUrl', () => {
  test('uses the BeeGreat scheme and a named callback path on Android', () => {
    let receivedOptions: { path?: string; scheme?: string } | undefined;

    const redirectUrl = makeClerkSsoRedirectUrl((options) => {
      receivedOptions = options;
      return options?.scheme && options.path
        ? `${options.scheme}://${options.path}`
        : 'beegreat://';
    });

    expect(receivedOptions).toEqual({
      scheme: 'beegreat',
      path: 'sso-callback',
    });
    expect(redirectUrl).toBe('beegreat://sso-callback');
  });
});
