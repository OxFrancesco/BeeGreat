export const PRO_ENTITLEMENT_ID = "pro" as const;
export const MONTHLY_PRODUCT_ID = "com.beegreat.app.pro.monthly" as const;
const MONTHLY_SUBSCRIPTION_PERIOD = "P1M";

export type SubscriptionPlan = {
  packageIdentifier: string;
  productIdentifier: string;
  localizedPrice: string;
};

export type SubscriptionSnapshot = {
  isPro: boolean;
  plan: SubscriptionPlan | null;
  managementUrl: string | null;
};

export type CustomerInfoLike = {
  entitlements: {
    verification: string;
    active: Record<
      string,
      { isActive: boolean; productIdentifier?: string } | undefined
    >;
  };
  managementURL: string | null;
};

export type OfferingsLike = {
  current: {
    monthly: {
      identifier: string;
      product: {
          identifier: string;
          priceString: string;
          subscriptionPeriod: string | null;
      };
    } | null;
  } | null;
};

export function hasProEntitlement(customerInfo: CustomerInfoLike): boolean {
  const pro = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
  return (
    customerInfo.entitlements.verification !== "FAILED" &&
    pro?.isActive === true &&
    pro.productIdentifier === MONTHLY_PRODUCT_ID
  );
}

export function currentMonthlyPlan(
  offerings: OfferingsLike,
): SubscriptionPlan | null {
  const monthly = offerings.current?.monthly;
  if (
    !monthly ||
    monthly.product.identifier !== MONTHLY_PRODUCT_ID ||
    monthly.product.subscriptionPeriod !== MONTHLY_SUBSCRIPTION_PERIOD
  ) {
    return null;
  }

  return {
    packageIdentifier: monthly.identifier,
    productIdentifier: monthly.product.identifier,
    localizedPrice: monthly.product.priceString,
  };
}

export function subscriptionSnapshot(
  customerInfo: CustomerInfoLike,
  offerings: OfferingsLike,
): SubscriptionSnapshot {
  return {
    isPro: hasProEntitlement(customerInfo),
    plan: currentMonthlyPlan(offerings),
    managementUrl: customerInfo.managementURL,
  };
}
