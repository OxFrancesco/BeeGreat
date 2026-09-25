import { EVM_CHAIN_ID, parseEvmCliOutput, type EvmRequest, type EvmResponse } from "./evm-protocol";

export type SandboxExec = (command: string, options: {
  cwd: string;
  timeout: number;
  env: Record<string, string | undefined>;
}) => Promise<{ success: boolean; exitCode: number; stdout: string; stderr: string }>;

export type EvmSandboxSettings = Readonly<{ rpcUrl: string; etherscanApiKey?: string }>;

const sdkDirectory = "/opt/evm";
const commandTimeoutMs = 90_000;
const commandPattern = /^[a-z][a-z-]*$/;

function redactedMessage(message: string, settings: EvmSandboxSettings): string {
  let text = message.replaceAll(settings.rpcUrl, "[RPC endpoint]").replace(/https?:\/\/[^\s"'<>]+/g, "[provider URL]");
  if (settings.etherscanApiKey) text = text.replaceAll(settings.etherscanApiKey, "[redacted]");
  return text.slice(0, 300);
}

/**
 * Run one allow-listed evm CLI command inside the sandbox. The JSON input
 * travels through an environment variable and a double-quoted shell
 * expansion so no user-controlled bytes are ever parsed by the shell. Each
 * call gets a throwaway journal directory that is removed before returning;
 * the Durable Object is the only durable record of any plan.
 */
export async function runEvmCommand(exec: SandboxExec, settings: EvmSandboxSettings, request: EvmRequest): Promise<EvmResponse> {
  if (!commandPattern.test(request.command)) throw new Error("Invalid evm command name");
  if (request.command !== "units" && request.input.chainId !== EVM_CHAIN_ID) {
    return { ok: false, error: { code: "ChainMismatch", message: "Only Base mainnet (chainId 8453) is supported", retryable: false } };
  }
  const journal = `/tmp/evm/${crypto.randomUUID()}`;
  const shell = [
    `printf '%s' "$EVM_INPUT" | bun dist/cli.js ${request.command} --stdin`,
    "status=$?",
    `rm -rf "${journal}"`,
    "exit $status",
  ].join("; ");
  let result: Awaited<ReturnType<SandboxExec>>;
  try {
    result = await exec(`( ${shell} )`, {
    cwd: sdkDirectory,
    timeout: commandTimeoutMs,
    env: {
      EVM_INPUT: JSON.stringify(request.input),
      EVM_RPC_URL: settings.rpcUrl,
      EVM_DATABASE: `${journal}/operations.sqlite`,
      EVM_ETHERSCAN_API_KEY: settings.etherscanApiKey,
    },
    });
  } catch {
    return { ok: false, error: { code: "SandboxUnavailable", message: "The wallet planning service is unavailable. Please try again shortly.", retryable: true } };
  }
  try {
    const response = parseEvmCliOutput(result.stdout);
    return response.ok ? response : { ...response, error: { ...response.error, message: redactedMessage(response.error.message, settings) } };
  } catch (error) {
    const detail = result.stderr.trim().split("\n").at(-1) ?? "";
    const message = error instanceof Error ? error.message : "evm CLI failed";
    return { ok: false, error: { code: "SandboxFailure", message: redactedMessage(detail ? `${message}: ${detail}` : `${message} (exit ${result.exitCode})`, settings), retryable: false } };
  }
}
