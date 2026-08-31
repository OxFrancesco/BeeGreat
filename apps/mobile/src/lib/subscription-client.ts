import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { z } from "zod";

import {
  SubscriptionClientError,
  type PurchaseOutcome,
  type SubscriptionClient,
  type SubscriptionClientErrorCode,
} from "./subscription-client-types";
import {
  currentMonthlyPlan,
  subscriptionSnapshot,
  type SubscriptionSnapshot,
} from "./subscription-state";

const PAYWALL_ID = "beegreat-pro-monthly";

function isClerkUserId(value: string): boolean {
  return /^user_[A-Za-z0-9]+$/.test(value);
}

const purchasesErrorSchema = z.object({ code: z.enum(PURCHASES_ERROR_CODE) });

function purchasesErrorCode(cause: unknown): PURCHASES_ERROR_CODE | undefined {
  const parsed = purchasesErrorSchema.safeParse(cause);
  return parsed.success ? parsed.data.code : undefined;
}

function normalizedError(cause: unknown): SubscriptionClientError {
  if (cause instanceof SubscriptionClientError) return cause;

  const code = purchasesErrorCode(cause);
  let normalizedCode: SubscriptionClientErrorCode = "unknown";
  let message =
    "BeeGreat Pro could not connect to the App Store. Please try again.";

  if (
    code === PURCHASES_ERROR_CODE.NETWORK_ERROR ||
    code === PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR ||
    code === PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR
  ) {
    normalizedCode = "network";
    message = "You appear to be offline. Check your connection and try again.";
  } else if (
    code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR ||
    code === PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR ||
    code === PURCHASES_ERROR_CODE.INVALID_APPLE_SUBSCRIPTION_KEY_ERROR
  ) {
    normalizedCode = "configuration";
    message = "BeeGreat Pro is not configured correctly yet.";
  } else if (code === PURCHASES_ERROR_CODE.INVALID_APP_USER_ID_ERROR) {
    normalizedCode = "identity";
    message = "BeeGreat could not verify your signed-in account.";
  } else if (
    code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  ) {
    normalizedCode = "offering-unavailable";
    message = "The monthly BeeGreat Pro plan is temporarily unavailable.";
  } else if (
    code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
    code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR ||
    code === PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR
  ) {
    normalizedCode = "store";
    message =
      "The App Store could not complete that request. Please try again.";
  }

  return new SubscriptionClientError(normalizedCode, message);
}

class RevenueCatSubscriptionClient implements SubscriptionClient {
  private activeAppUserId: string | null = null;
  private offerings: PurchasesOfferings | null = null;
  private monthlyPackage: PurchasesPackage | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  connect(input: {
    appUserId: string;
    apiKey: string;
  }): Promise<SubscriptionSnapshot> {
    return this.enqueue(() => this.connectSerialized(input));
  }

  private async connectSerialized(input: {
    appUserId: string;
    apiKey: string;
  }): Promise<SubscriptionSnapshot> {
    if (process.env.EXPO_OS !== "ios") {
      throw new SubscriptionClientError(
        "unsupported",
        "BeeGreat Pro purchases are currently available in the iOS app.",
      );
    }

    const appUserId = input.appUserId.trim();
    const apiKey = input.apiKey.trim();
    if (!isClerkUserId(appUserId)) {
      throw new SubscriptionClientError(
        "identity",
        "A signed-in BeeGreat account is required before purchasing.",
      );
    }
    if (!apiKey) {
      throw new SubscriptionClientError(
        "configuration",
        "BeeGreat Pro is not configured correctly yet.",
      );
    }

    try {
      if (!(await Purchases.isConfigured())) {
        Purchases.configure({
          apiKey,
          appUserID: appUserId,
          automaticDeviceIdentifierCollectionEnabled: false,
          entitlementVerificationMode:
            Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
        });
      } else if ((await Purchases.getAppUserID()) !== appUserId) {
        this.activeAppUserId = null;
        // Switching directly between known Clerk users avoids creating or using
        // a RevenueCat anonymous app user between BeeGreat sessions.
        await Purchases.logIn(appUserId);
      }

      const [resolvedAppUserId, isAnonymous] = await Promise.all([
        Purchases.getAppUserID(),
        Purchases.isAnonymous(),
      ]);
      if (isAnonymous || resolvedAppUserId !== appUserId) {
        throw new SubscriptionClientError(
          "identity",
          "BeeGreat could not verify your signed-in account.",
        );
      }

      this.activeAppUserId = appUserId;
      return await this.fetchSnapshot();
    } catch (error) {
      throw normalizedError(error);
    }
  }

  disconnect(appUserId: string): void {
    void this.enqueue(async () => {
      if (this.activeAppUserId !== appUserId) return;
      this.activeAppUserId = null;
      this.offerings = null;
      this.monthlyPackage = null;
      // Purchases.logOut() intentionally is not called: it creates a RevenueCat
      // anonymous ID. The next known Clerk user is selected with logIn instead.
    });
  }

  subscribe(
    appUserId: string,
    listener: (snapshot: SubscriptionSnapshot) => void,
  ): () => void {
    const customerInfoListener = (customerInfo: CustomerInfo) => {
      if (this.activeAppUserId !== appUserId) return;
      listener(
        subscriptionSnapshot(customerInfo, this.offerings ?? { current: null }),
      );
    };
    Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
    };
  }

  refresh(): Promise<SubscriptionSnapshot> {
    const appUserId = this.requireConnectedUser();
    return this.enqueue(async () => {
      this.requireConnectedUser(appUserId);
      try {
        return await this.fetchSnapshot();
      } catch (error) {
        throw normalizedError(error);
      }
    });
  }

  purchaseMonthly(): Promise<PurchaseOutcome> {
    const appUserId = this.requireConnectedUser();
    return this.enqueue(async () => {
      this.requireConnectedUser(appUserId);
      try {
        if (!this.monthlyPackage) {
          await this.loadOfferings();
        }
        if (!this.monthlyPackage) {
          throw new SubscriptionClientError(
            "offering-unavailable",
            "The monthly BeeGreat Pro plan is temporarily unavailable.",
          );
        }

        const result = await Purchases.purchasePackage(this.monthlyPackage);
        return {
          kind: "purchased",
          snapshot: await this.fetchSnapshot(result.customerInfo),
        };
      } catch (error) {
        const code = purchasesErrorCode(error);
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          return { kind: "cancelled" };
        }
        if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
          return { kind: "pending" };
        }
        throw normalizedError(error);
      }
    });
  }

  restore(): Promise<SubscriptionSnapshot> {
    const appUserId = this.requireConnectedUser();
    return this.enqueue(async () => {
      this.requireConnectedUser(appUserId);
      try {
        return await this.fetchSnapshot(await Purchases.restorePurchases());
      } catch (error) {
        throw normalizedError(error);
      }
    });
  }

  manage(): Promise<void> {
    const appUserId = this.requireConnectedUser();
    return this.enqueue(async () => {
      this.requireConnectedUser(appUserId);
      try {
        await Purchases.showManageSubscriptions();
      } catch (error) {
        throw normalizedError(error);
      }
    });
  }

  trackPaywallImpression(): Promise<void> {
    const appUserId = this.requireConnectedUser();
    return this.enqueue(async () => {
      this.requireConnectedUser(appUserId);
      try {
        await Purchases.trackCustomPaywallImpression({
          paywallId: PAYWALL_ID,
          offering: this.offerings?.current ?? null,
        });
      } catch (error) {
        throw normalizedError(error);
      }
    });
  }

  private requireConnectedUser(expectedAppUserId?: string): string {
    if (!this.activeAppUserId) {
      throw new SubscriptionClientError(
        "identity",
        "A signed-in BeeGreat account is required before purchasing.",
      );
    }
    if (
      expectedAppUserId &&
      this.activeAppUserId !== expectedAppUserId
    ) {
      throw new SubscriptionClientError(
        "identity",
        "BeeGreat could not verify your signed-in account.",
      );
    }
    return this.activeAppUserId;
  }

  private async loadOfferings(): Promise<PurchasesOfferings> {
    const offerings = await Purchases.getOfferings();
    this.offerings = offerings;
    this.monthlyPackage = currentMonthlyPlan(offerings)
      ? (offerings.current?.monthly ?? null)
      : null;
    return offerings;
  }

  private async fetchSnapshot(
    customerInfo?: CustomerInfo,
  ): Promise<SubscriptionSnapshot> {
    const resolvedCustomerInfo =
      customerInfo ?? (await Purchases.getCustomerInfo());
    let offerings = this.offerings ?? { current: null };
    try {
      offerings = await this.loadOfferings();
    } catch {
      // Offerings are presentation data. A temporary product-fetch failure must
      // never revoke an already verified entitlement or block restoration.
    }
    return subscriptionSnapshot(resolvedCustomerInfo, offerings);
  }
}

export const subscriptionClient: SubscriptionClient =
  new RevenueCatSubscriptionClient();
