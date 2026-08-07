import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

import { createPkce, randomState } from "./oauth";

describe("Clerk CLI OAuth", () => {
  test("creates independent PKCE and CSRF values", () => {
    const pkce = createPkce();
    expect(pkce.verifier).toHaveLength(43);
    expect(pkce.challenge).toBe(
      createHash("sha256").update(pkce.verifier).digest("base64url"),
    );
    expect(randomState()).not.toBe(pkce.verifier);
  });
});
