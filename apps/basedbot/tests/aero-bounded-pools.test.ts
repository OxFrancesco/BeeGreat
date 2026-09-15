import { expect, test } from "bun:test";
import { executeSugarAction, SugarClient } from "@beegreat/sugar";

class ObservedClient extends SugarClient {
  readonly requestedLimits: Array<number | undefined> = [];

  override async getPoolsForSwaps(limit?: number) {
    this.requestedLimits.push(limit);
    return [];
  }
}

test("an unfiltered pool limit bounds the RPC read", async () => {
  const client = new ObservedClient(8453);
  await executeSugarAction("pools", { chain: 8453, limit: 1 }, { clientFactory: () => client });
  expect(client.requestedLimits).toEqual([1]);
});

test("filtered pool searches retain the full candidate set", async () => {
  const client = new ObservedClient(8453);
  await executeSugarAction("pools", { chain: 8453, limit: 1, pool_type: "stable" }, { clientFactory: () => client });
  expect(client.requestedLimits).toEqual([undefined]);
});
