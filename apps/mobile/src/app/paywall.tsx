import { router } from 'expo-router';

import { SubscriptionPaywall } from '@/components/subscription/subscription-paywall';

const PRIVACY_URL = 'https://beedocs.pages.dev/privacy';
const TERMS_URL = 'https://beedocs.pages.dev/terms';

/** Upgrade sheet reachable from the profile after the one-time launch paywall. */
export default function PaywallScreen() {
  return (
    <SubscriptionPaywall
      termsUrl={TERMS_URL}
      privacyUrl={PRIVACY_URL}
      dismissLabel="Not now"
      onDismiss={() => router.back()}
    />
  );
}
