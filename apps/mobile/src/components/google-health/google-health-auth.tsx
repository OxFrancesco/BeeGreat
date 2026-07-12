import { api } from '@beegreat/backend/convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as WebBrowser from 'expo-web-browser';

const APP_REDIRECT_URI = 'beegreat://profile';

export function useGoogleHealthAuth() {
  const status = useQuery(api.googleHealthAuth.status);
  const beginAuthorization = useAction(
    api.googleHealthAuthActions.beginAuthorization,
  );
  const disconnect = useMutation(api.googleHealthAuth.disconnect);

  const connect = async () => {
    const { authorizationUrl } = await beginAuthorization({});
    const result = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      APP_REDIRECT_URI,
    );

    if (result.type === 'cancel' || result.type === 'dismiss') return false;
    if (result.type !== 'success') {
      throw new Error('Google Health did not finish connecting. Try again.');
    }

    const outcome = new URL(result.url).searchParams.get('googleHealth');
    if (outcome !== 'connected') {
      throw new Error('Google Health authorization did not complete. Try again.');
    }
    return true;
  };

  return {
    connect,
    disconnect: async () => disconnect({}),
    status,
  };
}
