import type { JsonValue } from "../src/json-contract";
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { runEvmCommand, type SandboxExec } from "../src/cloudflare/evm-sandbox";
import { EVM_COMMANDS, evmRequestSchema, parseEvmCliOutput } from "../src/cloudflare/evm-protocol";

const settings = { rpcUrl: "https://rpc.example/base", etherscanApiKey: "etherscan-key" };
const ok = (result: JsonValue) => `${JSON.stringify({ version: 1, ok: true, command: "token", result })}\n`;

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
  test.each([0, 7])("CLI exit %i preserves literal input, removes its journal and keeps the shell alive", async (cliExit) => {
    const directory = await mkdtemp(join(tmpdir(), "pecu-shell-test-"));
    const input = { chainId: 8453, note: 'it\'s "quoted"; $(printf expanded > "$PECU_TEST_INJECTION")\nsecond line' };
    let journal: string | undefined;
    const executions: { options: Parameters<SandboxExec>[1]; stdout: string; exitCode: number }[] = [];
    const exec: SandboxExec = async (command, options) => {
      const database = options.env.EVM_DATABASE;
      if (!database || !/^\/tmp\/evm\/[0-9a-f-]{36}\/operations\.sqlite$/.test(database)) throw new Error("Unsafe test journal path");
      journal = dirname(database);
      const child = Bun.spawn(["bash"], { stdin: "pipe", stdout: "pipe", stderr: "pipe", env: {
        ...Bun.env, ...options.env,
        PECU_TEST_DIRECTORY: directory,
        PECU_TEST_INJECTION: join(directory, "injected"),
        PECU_TEST_EXIT: String(cliExit),
        PECU_TEST_REPLY: ok({ symbol: "USDC" }),
      } });
      child.stdin.write(`bun() {
  mkdir -p "$(dirname "$EVM_DATABASE")"
  printf journal > "$EVM_DATABASE"
  cat > "$PECU_TEST_DIRECTORY/input"
  printf '%s\\n' "$@" > "$PECU_TEST_DIRECTORY/args"
  if [ "$PECU_TEST_EXIT" = 0 ]; then printf '%s' "$PECU_TEST_REPLY"; else printf 'fixture CLI failed\\n' >&2; fi
  return "$PECU_TEST_EXIT"
}
${command}
printf 'SHELL_STATUS=%s\\n' "$?"
`);
      child.stdin.end();
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      executions.push({ options, stdout, exitCode });
      return { success: cliExit === 0, exitCode: cliExit, stdout: stdout.replace(`SHELL_STATUS=${cliExit}\n`, ""), stderr };
    };
    try {
      const response = await runEvmCommand(exec, settings, { command: "token", input });
      expect(executions).toHaveLength(1);
      const execution = executions[0]!;
      expect(execution.options.cwd).toBe("/opt/evm");
      expect(execution.options.env.EVM_RPC_URL).toBe(settings.rpcUrl);
      expect(execution.options.env.EVM_ETHERSCAN_API_KEY).toBe(settings.etherscanApiKey);
      expect(execution.exitCode).toBe(0);
      expect(execution.stdout).toContain(`SHELL_STATUS=${cliExit}\n`);
      expect(await Bun.file(join(directory, "input")).text()).toBe(JSON.stringify(input));
      expect(await Bun.file(join(directory, "args")).text()).toBe("dist/cli.js\ntoken\n--stdin\n");
      expect(existsSync(join(directory, "injected"))).toBe(false);
      expect(journal && existsSync(journal)).toBe(false);
      if (cliExit === 0) expect(response).toEqual({ ok: true, result: { symbol: "USDC" } });
      else expect(response).toMatchObject({ ok: false, error: { code: "SandboxFailure", message: "evm CLI produced no output: fixture CLI failed" } });
    } finally {
      if (journal) await rm(journal, { recursive: true, force: true });
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("the request schema only admits allow-listed read and plan commands", () => {
    expect(EVM_COMMANDS).not.toContain("execute");
    expect(EVM_COMMANDS).not.toContain("wallet-connect");
    expect(EVM_COMMANDS).not.toContain("prepare");
    expect(evmRequestSchema.safeParse({ command: "execute", input: {} }).success).toBe(false);
    expect(evmRequestSchema.safeParse({ command: "token", input: { chainId: 8453 } }).success).toBe(true);
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
