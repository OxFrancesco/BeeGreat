import { z } from "zod";

export type CatalogStage = "rpc" | "index" | "validate";

export class CatalogStageError extends Error {
  constructor(readonly stage: CatalogStage, options: { cause: unknown }) {
    super(`Aero catalog ${stage} failed`, options);
    this.name = "CatalogStageError";
  }
}

const urlPattern = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]]+/gi;

/**
 * Keeps the first line plus viem's `Status:` and `Details:` lines and removes every URL,
 * because RPC providers put the credential in the endpoint path.
 */
export function sanitizeErrorText(text: string, limit = 300): string {
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  return [lines[0], ...lines.slice(1).filter(line => /^(Status|Details):/.test(line))]
    .filter(Boolean).join(" | ").replace(urlPattern, "[url]").slice(0, limit);
}

const errorSchema = z.object({ name: z.string().optional(), message: z.string().optional() });
/** The Sugar SDK's typed RPC failure; its `cause` is already reduced to public fields. */
const sugarRpcErrorSchema = z.object({
  _tag: z.literal("SugarRpcError"),
  code: z.string(),
  operation: z.string(),
  attempts: z.number(),
  retryable: z.boolean(),
  cause: z.object({ message: z.string().optional(), status: z.number().optional(), code: z.number().optional() }).optional(),
});

/** Low-cardinality, credential-free description of a catalog failure for logs. */
export function catalogErrorFields(cause: unknown) {
  const error = cause instanceof CatalogStageError ? cause.cause : cause;
  const plain = errorSchema.safeParse(error).data;
  const rpc = sugarRpcErrorSchema.safeParse(error).data;
  const message = rpc?.cause?.message ?? plain?.message;
  return {
    stage: cause instanceof CatalogStageError ? cause.stage : "unknown",
    error_name: plain?.name,
    error_code: rpc?.code,
    operation: rpc?.operation,
    attempts: rpc?.attempts,
    retryable: rpc?.retryable,
    cause_status: rpc?.cause?.status,
    cause_code: rpc?.cause?.code,
    error_message: message === undefined ? undefined : sanitizeErrorText(message),
  };
}
