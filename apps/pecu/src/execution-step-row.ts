import { plannedCallSchema } from "./domain";
import type { ExecutionStep } from "./state";

/** Columns shared by the SQLite and Durable Object execution journals. */
export type ExecutionStepRow = {
  intent_id: string;
  position: number;
  state: ExecutionStep["state"];
  role: string;
  from_address: string;
  to_address: string;
  data: string;
  value: string;
  transaction_id: string | null;
  hash: string | null;
};

export function executionStepFromRow(row: ExecutionStepRow): ExecutionStep {
  let step: ExecutionStep = {
    intentId: row.intent_id,
    position: row.position,
    state: row.state,
    call: plannedCallSchema.parse({ role: row.role, from: row.from_address, to: row.to_address, data: row.data, value: row.value }),
  };
  if (row.transaction_id !== null) step = { ...step, transactionId: row.transaction_id };
  if (row.hash !== null) step = { ...step, hash: row.hash };
  return step;
}
