import { z } from "zod";

export const EVM_CHAIN_ID = 8453 as const;

/**
 * Commands the pecu-evm sandbox is allowed to run. Everything here either
 * reads chain state or builds an unsigned plan. Signing, wallet connection,
 * execution, and journal recovery commands are deliberately absent: the
 * Durable Object owns credentials and the persisted intent.
 */
export const EVM_READ_COMMANDS = ["read", "token", "balance", "inspect", "decode", "allowance", "identity", "block", "transaction", "units", "safe-info", "safe-propose", "safe-approvals", "safe-cancel-propose", "safe-owner-propose", "safe-batch-propose", "safe-module-info", "safe-module-propose", "safe-budget", "safe-budget-propose", "safe-budget-revoke-propose", "safe-role-grant-propose", "safe-role-revoke-propose", "safe-role-check", "safe-passkey-address", "safe-passkey-owner-propose", "safe-sponsored-enable-propose"] as const;
export const EVM_PLAN_COMMANDS = ["prepare-call", "transfer", "approve", "revoke", "safe-deploy", "safe-approve", "safe-execute", "safe-execute-signatures", "safe-budget-spend", "safe-role-execute", "safe-roles-deploy", "safe-passkey-deploy"] as const;
export const EVM_COMMANDS = [...EVM_READ_COMMANDS, ...EVM_PLAN_COMMANDS] as const;
export type EvmCommand = (typeof EVM_COMMANDS)[number];

export const evmRequestSchema = z.object({
  command: z.enum(EVM_COMMANDS),
  input: z.record(z.string(), z.unknown()),
});
export type EvmRequest = z.infer<typeof evmRequestSchema>;

export const evmErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});
export type EvmError = z.infer<typeof evmErrorSchema>;

/** The JSON line the evm CLI prints on stdout. */
export const evmCliEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ version: z.literal(1), ok: z.literal(true), command: z.string(), result: z.unknown() }),
  z.object({ version: z.literal(1), ok: z.literal(false), error: evmErrorSchema }),
]);

export const evmResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: evmErrorSchema }),
]);
export type EvmResponse = z.infer<typeof evmResponseSchema>;

export class EvmCommandError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean) {
    super(message);
    this.name = "EvmCommandError";
  }
}

export function isEvmCommand(value: string): value is EvmCommand {
  return EVM_COMMANDS.some((command) => command === value);
}

/** Parse the last non-empty stdout line the CLI emitted. */
export function parseEvmCliOutput(stdout: string): EvmResponse {
  const line = stdout.trim().split("\n").filter((entry) => entry.trim().length > 0).at(-1);
  if (!line) throw new Error("evm CLI produced no output");
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("evm CLI produced invalid JSON");
  }
  const envelope = evmCliEnvelopeSchema.parse(parsed);
  return envelope.ok ? { ok: true, result: envelope.result } : { ok: false, error: envelope.error };
}
