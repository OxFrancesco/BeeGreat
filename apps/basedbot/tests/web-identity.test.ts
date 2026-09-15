import { test, expect } from "bun:test";
import { verifiedXAccount } from "../src/web-identity";
const account = {
  provider: "oauth_twitter",
  providerUserId: "123",
  verification: { status: "verified" },
};
test("links only a single verified provider user ID, ignoring editable metadata", () => {
  expect(verifiedXAccount([account])).toBe("123");
  expect(() =>
    verifiedXAccount([{ ...account, verification: { status: "unverified" } }]),
  ).toThrow();
  expect(() =>
    verifiedXAccount([{ ...account, provider: "oauth_google" }]),
  ).toThrow();
  expect(() =>
    verifiedXAccount([
      { ...account, providerUserId: "", publicMetadata: { xId: "123" } },
    ]),
  ).toThrow();
  expect(() =>
    verifiedXAccount([account, { ...account, providerUserId: "456" }]),
  ).toThrow();
});
