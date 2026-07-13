import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  toError,
} from '@beegreat/observability';
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const environment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
  (__DEV__ ? 'development' : 'production');

export const sentryNavigationIntegration =
  Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: !isRunningInExpoGo(),
    useFullPathsForNavigationRoutes: false,
  });

const tracePropagationTargets = [
  process.env.EXPO_PUBLIC_AGENT_URL,
  process.env.EXPO_PUBLIC_CONVEX_URL,
]
  .filter((value): value is string => Boolean(value))
  .map((value) => new URL(value).origin);

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  initialScope: { tags: { service: 'mobile-app' } },
  integrations: [
    sentryNavigationIntegration,
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
      screenshotStrategy: 'canvas',
    }),
  ],
  attachStacktrace: true,
  attachScreenshot: false,
  attachViewHierarchy: false,
  enableNativeCrashHandling: true,
  enableAutoSessionTracking: true,
  enableAppHangTracking: true,
  appHangTimeoutInterval: 2,
  enableAppStartTracking: true,
  enableNativeFramesTracking: true,
  enableStallTracking: true,
  enableUserInteractionTracing: true,
  enableCaptureFailedRequests: true,
  tracesSampleRate: __DEV__ ? 1 : 0.2,
  profilesSampleRate: __DEV__ ? 0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  tracePropagationTargets,
  maxBreadcrumbs: 75,
});

/** Reports a failure that the UI handled before it could reach an error boundary. */
export function captureMobileFailure(
  error: unknown,
  operation: string,
  extra?: Record<string, unknown>,
) {
  const normalized = toError(error);
  if (
    normalized.name === 'AbortError' ||
    /(?:cancelled|canceled|dismissed) by (?:the )?user/i.test(normalized.message)
  ) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag('service', 'mobile-app');
    scope.setTag('operation', operation);
    scope.setTag('handled', 'true');
    if (extra) scope.setExtras(extra);
    Sentry.captureException(normalized);
  });
}

export { Sentry };
