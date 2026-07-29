type MakeRedirectUri = (options?: {
  path?: string;
  scheme?: string;
}) => string;

const CLERK_SSO_CALLBACK_PATH = 'sso-callback';
const CLERK_SSO_SCHEME = 'beegreat';

export function makeClerkSsoRedirectUrl(
  makeRedirectUri: MakeRedirectUri,
): string {
  return makeRedirectUri({
    scheme: CLERK_SSO_SCHEME,
    path: CLERK_SSO_CALLBACK_PATH,
  });
}
