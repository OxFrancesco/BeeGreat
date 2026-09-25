import { expect, test } from "bun:test";
import { evmWorkerExecutor } from "../src/cloudflare/evm-client";

test("stalled wallet reads time out and abort instead of blocking the queue", async () => {
  let signal: AbortSignal | undefined;
  let requests = 0;
  const service: Pick<Fetcher, "fetch"> = { fetch: async (_url, init) => {
    requests++;
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  } };
  const execute = evmWorkerExecutor(service, 10);
  await expect(execute("balance", { chainId: 8453 })).rejects.toThrow("took too long");
  expect(signal?.aborted).toBe(true);
  expect(requests).toBe(1);
});
