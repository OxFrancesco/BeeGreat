import { Redirect } from 'expo-router';

import { PlaygroundScreen } from '@/components/playground/playground-screen';

/** Dev-only component gallery; production builds bounce to the chat tab. */
export default function PlaygroundRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <PlaygroundScreen />;
}
