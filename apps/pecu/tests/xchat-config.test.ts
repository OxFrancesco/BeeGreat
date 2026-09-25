import { jsonFieldsSchema } from "../src/json-contract";
import { describe, expect, test } from "bun:test";
import { normalizeJuiceboxConfig } from "../src/x/chat";

describe("X SDK Juicebox configuration boundary", () => {
  test("restores recursively camel-cased XDK keys without changing values", () => {
    const embedded = JSON.stringify({
      realms: [
        {
          id: "0f".repeat(16),
          address: "https://realm.invalid/",
          public_key: "example-public-key",
        },
      ],
      register_threshold: 1,
      recover_threshold: 1,
      pin_hashing_mode: "Standard2019",
    });
    const normalized = jsonFieldsSchema.parse(JSON.parse(normalizeJuiceboxConfig({
      keyStoreTokenMapJson: embedded,
      maxGuessCount: 20,
      tokenMap: [
        {
          key: "0f".repeat(16),
          value: {
            address: "https://realm.invalid/",
            token: "example-token-value",
          },
        },
      ],
    })));

    expect(normalized.key_store_token_map_json).toBe(embedded);
    expect(normalized.max_guess_count).toBe(20);
    expect(normalized.token_map).toEqual([
      {
        key: "0f".repeat(16),
        value: {
          address: "https://realm.invalid/",
          token: "example-token-value",
        },
      },
    ]);
  });
});
