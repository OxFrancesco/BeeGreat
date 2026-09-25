import { describe, expect, test } from "bun:test";
import { runEvmCommand, type SandboxExec } from "../src/cloudflare/evm-sandbox";
import { EVM_COMMANDS, evmRequestSchema, parseEvmCliOutput } from "../src/cloudflare/evm-protocol";

const settings = { rpcUrl: "https://rpc.example/base", etherscanApiKey: "etherscan-key" };
const ok = (result: unknown) => `${JSON.stringify({ version: 1, ok: true, command: "token", result })}\n`;

function recordingExec(stdout: string, exitCode = 0) {
  const calls: Array<{ command: string; options: Parameters<SandboxExec>[1] }> = [];
  const exec: SandboxExec = async (command, options) => {
    calls.push({ command, options });
    return { success: exitCode === 0, exitCode, stdout, stderr: exitCode === 0 ? "" : "boom: sqlite locked" };
  };
  return { exec, calls };
}

describe("evm sandbox worker", () => {
  test("provider credentials are redacted from structured and process errors", async () => {
    const message = `RPC ${settings.rpcUrl} failed with ${settings.etherscanApiKey}`;
    const exec: SandboxExec = async () => ({ success: false, exitCode: 1, stderr: message, stdout: JSON.stringify({ version: 1, ok: false, error: { code: "RpcFailure", message, retryable: true } }) });
    const response = await runEvmCommand(exec, settings, { command: "safe-info", input: { chainId: 8453 } });
    expect(JSON.stringify(response)).not.toContain(settings.rpcUrl);
    expect(JSON.stringify(response)).not.toContain(settings.etherscanApiKey);
    const failed: SandboxExec = async () => { throw new Error(message); };
    expect(await runEvmCommand(failed, settings, { command: "safe-info", input: { chainId: 8453 } })).toMatchObject({ ok: false, error: { code: "SandboxUnavailable", retryable: true } });
  });
  test("the command does not exit the persistent sandbox shell", async () => {
    const exec: SandboxExec = async (command, options) => {
      const child = Bun.spawn(["bash"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { ...Bun.env, ...Object.fromEntries(Object.entries(options.env).filter((entry): entry is [string, string] => entry[1] !== undefined)) } });
      child.stdin.write(`bun() { printf '%s\\n' '${JSON.stringify({ version: 1, ok: true, command: "token", result: {} })}'; }\n${command}\nprintf 'SHELL_STILL_RUNNING\\n'\n`);
      child.stdin.end();
      const stdout = await new Response(child.stdout).text();
      const stderr = await new Response(child.stderr).text();
      const exitCode = await child.exited;
      expect(stdout).toContain("SHELL_STILL_RUNNING");
      return { success: exitCode === 0, exitCode, stdout: stdout.replace("SHELL_STILL_RUNNING\n", ""), stderr };
    };
    expect(await runEvmCommand(exec, settings, { command: "token", input: { chainId: 8453 } })).toEqual({ ok: true, result: {} });
  });

  test("the request schema only admits allow-listed read and plan commands", () => {
    expect(EVM_COMMANDS).not.toContain("execute");
    expect(EVM_COMMANDS).not.toContain("wallet-connect");
    expect(EVM_COMMANDS).not.toContain("prepare");
    expect(evmRequestSchema.safeParse({ command: "execute", input: {} }).success).toBe(false);
    expect(evmRequestSchema.safeParse({ command: "token", input: { chainId: 8453 } }).success).toBe(true);
  });

  test("passes JSON input through the environment and cleans up the throwaway journal", async () => {
    const { exec, calls } = recordingExec(ok({ symbol: "USDC" }));
    const input = { chainId: 8453, address: "0x1111111111111111111111111111111111111111", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", note: "it's \"quoted\"; $(rm -rf /)" };
    const response = await runEvmCommand(exec, settings, { command: "token", input });
    expect(response).toEqual({ ok: true, result: { symbol: "USDC" } });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.command).toBe(`( printf '%s' "$EVM_INPUT" | bun dist/cli.js token --stdin; status=$?; rm -rf "${call?.options.env.EVM_DATABASE?.replace("/operations.sqlite", "")}"; exit $status )`);
    expect(call?.command).not.toContain("rm -rf /)");
    expect(call?.options.cwd).toBe("/opt/evm");
    expect(call?.options.env.EVM_INPUT).toBe(JSON.stringify(input));
    expect(call?.options.env.EVM_RPC_URL).toBe(settings.rpcUrl);
    expect(call?.options.env.EVM_ETHERSCAN_API_KEY).toBe("etherscan-key");
    expect(call?.options.env.EVM_DATABASE).toMatch(/^\/tmp\/evm\/[0-9a-f-]{36}\/operations\.sqlite$/);
  });

  test("refuses any chain other than Base without touching the sandbox", async () => {
    const { exec, calls } = recordingExec(ok({}));
    const response = await runEvmCommand(exec, settings, { command: "balance", input: { chainId: 1, address: "0x1111111111111111111111111111111111111111" } });
    expect(response).toEqual({ ok: false, error: { code: "ChainMismatch", message: "Only Base mainnet (chainId 8453) is supported", retryable: false } });
    expect(calls).toHaveLength(0);
  });

  test("units needs no chain", async () => {
    const { exec, calls } = recordingExec(ok({ baseUnits: "1000000" }));
    await runEvmCommand(exec, settings, { command: "units", input: { amount: "1", decimals: 6 } });
    expect(calls).toHaveLength(1);
  });

  test("returns the CLI's structured error envelope", async () => {
    const { exec } = recordingExec(`${JSON.stringify({ version: 1, ok: false, error: { code: "SimulationReverted", message: "execution reverted", retryable: false } })}\n`, 1);
    const response = await runEvmCommand(exec, settings, { command: "transfer", input: { chainId: 8453 } });
    expect(response).toEqual({ ok: false, error: { code: "SimulationReverted", message: "execution reverted", retryable: false } });
  });

  test("surfaces a sandbox failure when the CLI prints nothing usable", async () => {
    const { exec } = recordingExec("", 137);
    const response = await runEvmCommand(exec, settings, { command: "token", input: { chainId: 8453 } });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("SandboxFailure");
      expect(response.error.message).toContain("sqlite locked");
    }
  });

  test("parses the last stdout line so stray logs do not break the envelope", () => {
    const parsed = parseEvmCliOutput(`warning: something\n${JSON.stringify({ version: 1, ok: true, command: "read", result: { value: "1" } })}\n`);
    expect(parsed).toEqual({ ok: true, result: { value: "1" } });
    expect(() => parseEvmCliOutput("not json")).toThrow("invalid JSON");
    expect(() => parseEvmCliOutput("")).toThrow("no output");
  });
});
