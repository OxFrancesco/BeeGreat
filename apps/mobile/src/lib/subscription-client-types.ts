import type { SubscriptionSnapshot } from "./subscription-state";

export type SubscriptionClientErrorCode =
  | "configuration"
  | "identity"
  | "network"
  | "offering-unavailable"
  | "store"
  | "unsupported"
  | "unknown";

export class SubscriptionClientError extends Error {
  readonly code: SubscriptionClientErrorCode;

  constructor(code: SubscriptionClientErrorCode, message: string) {
    super(message);
    this.name = "SubscriptionClientError";
    this.code = code;
  }
}

export type PurchaseOutcome =
  | { kind: "purchased"; snapshot: SubscriptionSnapshot }
  | { kind: "cancelled" }
  | { kind: "pending" };

export interface SubscriptionClient {
  connect(input: {
    appUserId: string;
    apiKey: string;
  }): Promise<SubscriptionSnapshot>;
  disconnect(appUserId: string): void;
  subscribe(
    appUserId: string,
    listener: (snapshot: SubscriptionSnapshot) => void,
  ): () => void;
  refresh(): Promise<SubscriptionSnapshot>;
  purchaseMonthly(): Promise<PurchaseOutcome>;
  restore(): Promise<SubscriptionSnapshot>;
  manage(): Promise<void>;
  trackPaywallImpression(): Promise<void>;
}
