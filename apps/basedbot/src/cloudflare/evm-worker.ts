import { getSandbox, Sandbox } from "@cloudflare/sandbox";
import { evmRequestSchema, type EvmRequest } from "./evm-protocol";
import { runEvmCommand } from "./evm-sandbox";

export class EvmSandbox extends Sandbox {
  override sleepAfter = "10m";
}

type EvmEnv = {
  EVM_SANDBOX: DurableObjectNamespace<EvmSandbox>;
  ALCHEMY_RPC_URL?: string;
  BASE_RPC_URL?: string;
  ETHERSCAN_API_KEY?: string;
};

const sandboxName = "basedbot-evm";

export default {
  async fetch(request: Request, env: EvmEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/run" || request.method !== "POST") return new Response(null, { status: 404 });
    const rpcUrl = env.ALCHEMY_RPC_URL ?? env.BASE_RPC_URL;
    if (!rpcUrl) return Response.json({ ok: false, error: { code: "Configuration", message: "ALCHEMY_RPC_URL is not configured", retryable: false } }, { status: 503 });
    let parsed: EvmRequest;
    try {
      parsed = evmRequestSchema.parse(await request.json());
    } catch (error) {
      return Response.json({ ok: false, error: { code: "InvalidInput", message: error instanceof Error ? error.message : "Invalid request", retryable: false } }, { status: 400 });
    }
    const sandbox = getSandbox(env.EVM_SANDBOX, sandboxName);
    const sessionId = `evm-${crypto.randomUUID()}`;
    const session = await sandbox.createSession({ id: sessionId });
    try {
      const response = await runEvmCommand(
        (command, options) => session.exec(command, options),
        { rpcUrl, ...(env.ETHERSCAN_API_KEY ? { etherscanApiKey: env.ETHERSCAN_API_KEY } : {}) },
        parsed,
      );
      const status = response.ok ? 200 : response.error.code === "InvalidInput" || response.error.code === "ChainMismatch" ? 400 : 502;
      return Response.json(response, { status });
    } finally {
      await sandbox.deleteSession(sessionId).catch(() => undefined);
    }
  },
} satisfies ExportedHandler<EvmEnv>;
