import { z } from "zod";
import { loadConfig } from "./config";

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
try {
  const config = loadConfig();
  results.push({ check: "configuration", ok: true, detail: `production Crossmint key; execution ${config.enableMainnetExecution ? "ENABLED" : "locked"}` });
  results.push({ check: "X OAuth", ok: Boolean(config.xAccessToken || Bun.which("xurl")), detail: config.xAccessToken ? "X_ACCESS_TOKEN configured" : "xurl will provide the user token at runtime" });
  try {
    const response = await fetch(config.baseRpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
    const body = z.object({ result: z.string().optional() }).parse(await response.json());
    results.push({ check: "Base RPC", ok: body.result === "0x2105", detail: body.result === "0x2105" ? "chain 8453" : `unexpected chain ${body.result ?? "unknown"}` });
  } catch (error) {
    results.push({ check: "Base RPC", ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
} catch (error) {
  results.push({ check: "configuration", ok: false, detail: error instanceof Error ? error.message : String(error) });
}
for (const result of results) console.log(`${result.ok ? "✓" : "✗"} ${result.check}: ${result.detail}`);
if (results.some((result) => !result.ok)) process.exitCode = 1;
