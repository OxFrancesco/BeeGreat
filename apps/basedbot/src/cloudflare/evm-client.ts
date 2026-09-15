import type { EvmExecutor } from "../evm";
import { EvmCommandError, evmResponseSchema } from "./evm-protocol";

export function evmWorkerExecutor(service: Pick<Fetcher, "fetch">, timeoutMs = 120_000): EvmExecutor {
  return async (command, input) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new EvmCommandError("Timeout", "The wallet service took too long. Please try again shortly.", true));
        controller.abort();
      }, timeoutMs);
    });
    try {
      return await Promise.race([expired, (async () => {
        const response = await service.fetch("https://evm.internal/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, input }),
          signal: controller.signal,
        });
        const payload = evmResponseSchema.safeParse(await response.json().catch(() => undefined));
        if (!payload.success) throw new Error(`EVM Worker returned HTTP ${response.status}`);
        if (!payload.data.ok) throw new EvmCommandError(payload.data.error.code, payload.data.error.message, payload.data.error.retryable);
        return payload.data.result;
      })()]);
    } finally {
      clearTimeout(timer!);
    }
  };
}
