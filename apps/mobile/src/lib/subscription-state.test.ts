// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from "bun:test";

import {
  currentMonthlyPlan,
  hasProEntitlement,
  PRO_ENTITLEMENT_ID,
  subscriptionSnapshot,
  type CustomerInfoLike,
  type OfferingsLike,
} from "./subscription-state";

function customerInfo(
  active: CustomerInfoLike["entitlements"]["active"] = {},
): CustomerInfoLike {
  return {
    entitlements: { active, verification: "VERIFIED" },
    managementURL: "https://apps.apple.com/account/subscriptions",
  };
}

function offerings(priceString = "$6.99"): OfferingsLike {
  return {
    current: {
      monthly: {
        identifier: "$rc_monthly",
        product: {
          identifier: "com.beegreat.app.pro.monthly",
          priceString,
          subscriptionPeriod: "P1M",
        },
      },
    },
  };
}

describe("BeeGreat Pro entitlement state", () => {
  test("uses the single RevenueCat pro entitlement", () => {
    expect(PRO_ENTITLEMENT_ID).toBe("pro");
    expect(hasProEntitlement(customerInfo())).toBe(false);
    expect(
      hasProEntitlement(
        customerInfo({
          pro: {
            isActive: true,
            productIdentifier: "com.beegreat.app.pro.monthly",
          },
        }),
      ),
    ).toBe(true);
    expect(
      hasProEntitlement(
        customerInfo({
          pro: { isActive: false },
        }),
      ),
    ).toBe(false);
    expect(
      hasProEntitlement(
        customerInfo({
          pro: {
            isActive: true,
            productIdentifier: "com.beegreat.app.wrong",
          },
        }),
      ),
    ).toBe(false);
    expect(
      hasProEntitlement({
        ...customerInfo({
          pro: {
            isActive: true,
            productIdentifier: "com.beegreat.app.pro.monthly",
          },
        }),
        entitlements: {
          active: {
            pro: {
              isActive: true,
              productIdentifier: "com.beegreat.app.pro.monthly",
            },
          },
          verification: "FAILED",
        },
      }),
    ).toBe(false);
  });

  test("selects only the current monthly package and preserves its localized price", () => {
    expect(currentMonthlyPlan(offerings("6,99\u00a0€"))).toEqual({
      packageIdentifier: "$rc_monthly",
      productIdentifier: "com.beegreat.app.pro.monthly",
      localizedPrice: "6,99\u00a0€",
    });
    expect(currentMonthlyPlan({ current: null })).toBeNull();
    expect(currentMonthlyPlan({ current: { monthly: null } })).toBeNull();
    expect(
      currentMonthlyPlan({
        current: {
          monthly: {
            ...offerings().current!.monthly!,
            product: {
              ...offerings().current!.monthly!.product,
              identifier: "com.beegreat.app.wrong",
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      currentMonthlyPlan({
        current: {
          monthly: {
            ...offerings().current!.monthly!,
            product: {
              ...offerings().current!.monthly!.product,
              subscriptionPeriod: "P1Y",
            },
          },
        },
      }),
    ).toBeNull();
  });

  test("combines entitlement, offering, and management state without inferring access", () => {
    expect(
      subscriptionSnapshot(
        customerInfo({
          [PRO_ENTITLEMENT_ID]: {
            isActive: true,
            productIdentifier: "com.beegreat.app.pro.monthly",
          },
        }),
        offerings(),
      ),
    ).toEqual({
      isPro: true,
      plan: {
        packageIdentifier: "$rc_monthly",
        productIdentifier: "com.beegreat.app.pro.monthly",
        localizedPrice: "$6.99",
      },
      managementUrl: "https://apps.apple.com/account/subscriptions",
    });
  });
});
