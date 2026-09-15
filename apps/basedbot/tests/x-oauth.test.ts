import { describe, expect, test } from "bun:test";
import { isUnauthorizedXApiError, refreshXOAuthToken } from "../src/x/oauth";

describe("X OAuth refresh", () => {
  test("rotates a confidential client's access and refresh tokens", async () => {
    const tokens = await refreshXOAuthToken({
      clientId: "client-id",
      clientSecret: "client-secret",
      refreshToken: "old-refresh",
    }, async (_url, init) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Authorization")).toStartWith("Basic ");
      expect(String(init?.body)).toContain("refresh_token=old-refresh");
      return Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 7_200,
      });
    });
    expect(tokens).toEqual({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 7_200 });
  });

  test("identifies only X API unauthorized responses", () => {
    expect(isUnauthorizedXApiError(new Error("HTTP 401: Unauthorized"))).toBe(true);
    expect(isUnauthorizedXApiError(new Error("HTTP 429: Too Many Requests"))).toBe(false);
  });
});
