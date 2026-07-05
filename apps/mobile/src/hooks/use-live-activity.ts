import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { OrbState } from '@/components/agent/voice-orb';
import type { BeeActivityProps } from '@/components/agent/bee-activity';

type BeeActivityFactory = typeof import('@/components/agent/bee-activity').default;
type BeeActivityInstance = ReturnType<BeeActivityFactory['start']>;

let factory: BeeActivityFactory | null | undefined;

// Lazy require: expo-widgets needs a development build, so this quietly
// no-ops in Expo Go and on Android instead of crashing at import time.
function getFactory(): BeeActivityFactory | null {
  if (factory !== undefined) return factory;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    factory = (require('@/components/agent/bee-activity') as {
      default: BeeActivityFactory;
    }).default;
  } catch {
    factory = null;
  }
  return factory;
}

const STATUS_LABELS: Record<Exclude<OrbState, 'idle'>, string> = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

/**
 * Mirrors the agent's live state into the native Dynamic Island / Lock Screen
 * via an ActivityKit Live Activity while a voice session is in flight.
 */
export function useBeeLiveActivity(state: OrbState, detail: string) {
  const instance = useRef<BeeActivityInstance | null>(null);

  // If the app was killed mid-session, its activity lingers in the Dynamic
  // Island / Lock Screen for hours. Sweep stale instances on launch.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try {
      for (const stale of getFactory()?.getInstances() ?? []) {
        stale.end('immediate');
      }
    } catch {
      // Best-effort cleanup.
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try {
      if (state === 'idle') {
        instance.current?.end('immediate');
        instance.current = null;
        return;
      }
      const props: BeeActivityProps = { status: STATUS_LABELS[state], detail };
      if (instance.current) {
        instance.current.update(props);
      } else {
        instance.current = getFactory()?.start(props) ?? null;
      }
    } catch (error) {
      console.warn('[live-activity]', error);
      instance.current = null;
    }
  }, [state, detail]);

  useEffect(
    () => () => {
      try {
        instance.current?.end('immediate');
      } catch {
        // Already gone.
      }
    },
    [],
  );
}
