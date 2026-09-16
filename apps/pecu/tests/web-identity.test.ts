import { test, expect } from "bun:test";
import { senderKind, verifiedXAccount, webSenderId } from "../src/web-identity";
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
test("a linked X account keeps the X wallet; other Clerk sign-ins get a web sender", () => {
  const google = {
    provider: "oauth_google",
    providerUserId: "g-1",
    verification: { status: "verified" },
  };
  expect(webSenderId("user_abc", [account])).toBe("123");
  expect(webSenderId("user_abc", [account, google])).toBe("123");
  expect(webSenderId("user_abc", [google])).toBe("web-user_abc");
  expect(webSenderId("user_abc", [])).toBe("web-user_abc");
  expect(
    webSenderId("user_abc", [
      { ...account, verification: { status: "unverified" } },
    ]),
  ).toBe("web-user_abc");
  expect(() =>
    webSenderId("user_abc", [account, { ...account, providerUserId: "456" }]),
  ).toThrow();
  expect(() => webSenderId("123", [])).toThrow();
  expect(() => webSenderId("user_abc:evm", [])).toThrow();
  expect(senderKind("123")).toBe("x");
  expect(senderKind("web-user_abc")).toBe("web");
});
