import {
  SubscriptionClientError,
  type PurchaseOutcome,
  type SubscriptionClient,
} from "./subscription-client-types";
import type { SubscriptionSnapshot } from "./subscription-state";

function unsupported(): SubscriptionClientError {
  return new SubscriptionClientError(
    "unsupported",
    "BeeGreat Pro purchases are currently available in the iOS app.",
  );
}

class WebSubscriptionClient implements SubscriptionClient {
  async connect(): Promise<SubscriptionSnapshot> {
    throw unsupported();
  }

  disconnect(): void {}

  subscribe(): () => void {
    return () => {};
  }

  async refresh(): Promise<SubscriptionSnapshot> {
    throw unsupported();
  }

  async purchaseMonthly(): Promise<PurchaseOutcome> {
    throw unsupported();
  }

  async restore(): Promise<SubscriptionSnapshot> {
    throw unsupported();
  }

  async manage(): Promise<void> {
    throw unsupported();
  }

  async trackPaywallImpression(): Promise<void> {
    // A web paywall is intentionally not tracked as an iOS RevenueCat paywall.
  }
}

export const subscriptionClient: SubscriptionClient =
  new WebSubscriptionClient();
