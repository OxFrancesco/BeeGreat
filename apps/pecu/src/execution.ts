import { Cause, Effect, Exit, Option, Result, Schema } from "effect";
import type { PlannedCall } from "./domain";
import type { UserOperationOutcome, UserOperationReference } from "./receipt";
import type { AgentStateStore } from "./state";
import type { WalletApproval, WalletTransaction } from "./wallet";

/**
 * Step execution against Crossmint, with the failure taxonomy made explicit.
 *
 * The only question that matters after an error is whether Crossmint may have
 * been asked to approve the step. If not, the intent can safely fail. If it
 * may have, the intent must stay `executing` so a later `/confirm` or a boot
 * recovery re-reads Crossmint instead of declaring a possibly-landed user
 * operation dead.
 */

/** Nothing was approved, or Crossmint reports a definite failure before inclusion. Terminal. */
export class StepFailed extends Schema.TaggedError<StepFailed>()("StepFailed", {
  position: Schema.Number,
  reason: Schema.String,
}) {
  override get message(): string {
    return this.reason;
  }
}

/** A prepared transaction exists and approval may have happened, but its state could not be read. Keep executing. */
export class OutcomeUnknown extends Schema.TaggedError<OutcomeUnknown>()("OutcomeUnknown", {
  position: Schema.Number,
  transactionId: Schema.String,
  hash: Schema.optional(Schema.String),
  reason: Schema.String,
}) {
  override get message(): string {
    return `Could not determine the state of transaction ${this.transactionId}: ${this.reason}`;
  }
}

/** Approved and submitted; inclusion is not verifiable yet. Keep executing. */
export class InclusionPending extends Schema.TaggedError<InclusionPending>()("InclusionPending", {
  position: Schema.Number,
  hash: Schema.optional(Schema.String),
}) {
  override get message(): string {
    return this.hash ? `Transaction ${this.hash} was submitted but is not yet included on Base` : "Transaction was submitted but has no hash yet";
  }
}

/** Included on Base and the user operation reverted. Terminal. */
export class Reverted extends Schema.TaggedError<Reverted>()("Reverted", {
  position: Schema.Number,
  hash: Schema.String,
}) {
  override get message(): string {
    return `Transaction ${this.hash} was included but the user operation reverted`;
  }
}

export type StepFailure = StepFailed | OutcomeUnknown | InclusionPending | Reverted;

export type StepsResult =
  | Readonly<{ outcome: "succeeded"; hashes: readonly string[] }>
  | Readonly<{ outcome: "failed"; failure: StepFailed | Reverted }>
  | Readonly<{ outcome: "unsettled"; failure: OutcomeUnknown | InclusionPending }>;

export type StepWallets = Readonly<{
  prepare(senderId: string, call: PlannedCall): Promise<{ transactionId: string }>;
  transaction(senderId: string, transactionId: string): Promise<WalletTransaction>;
  approve(senderId: string, transactionId: string): Promise<WalletApproval>;
}>;

export type StepExecutionDeps = Readonly<{
  wallets: StepWallets;
  journal: Pick<AgentStateStore, "steps" | "markStepPrepared" | "markStepSubmitted" | "markStepSucceeded">;
  verifyUserOperation(reference: UserOperationReference): Promise<UserOperationOutcome>;
}>;

export type StepExecutionRequest = Readonly<{
  intentId: string;
  senderId: string;
  wallet: `0x${string}`;
  expiresAt: number;
}>;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const executeStep = Effect.fn("Pecu.executeStep")(function* (
  deps: StepExecutionDeps,
  request: StepExecutionRequest,
  step: { position: number; call: PlannedCall; transactionId?: string },
) {
  const { position } = step;
  const { intentId, senderId, wallet, expiresAt } = request;

  let transactionId = step.transactionId;
  if (transactionId === undefined) {
    if (Date.now() > expiresAt) {
      return yield* new StepFailed({ position, reason: "This transaction preview expired before the next step could be sent. Request a fresh preview." });
    }
    const prepared = yield* Effect.tryPromise({
      try: () => deps.wallets.prepare(senderId, step.call),
      catch: (error) => new StepFailed({ position, reason: errorMessage(error) }),
    });
    transactionId = prepared.transactionId;
    deps.journal.markStepPrepared(intentId, position, transactionId);
  }

  const id = transactionId;
  const unsettled = (cause: unknown, hash?: string) => new OutcomeUnknown({ position, transactionId: id, hash: hash || undefined, reason: errorMessage(cause) });
  const readRecord = Effect.tryPromise({ try: () => deps.wallets.transaction(senderId, id), catch: (error) => unsettled(error) });

  let record = yield* readRecord;
  if (record.sender.toLowerCase() !== wallet.toLowerCase()) {
    return yield* new StepFailed({ position, reason: "Crossmint transaction belongs to a different wallet" });
  }

  if (record.status === "awaiting-approval") {
    if (Date.now() > expiresAt) {
      return yield* new StepFailed({ position, reason: "This transaction preview expired before approval. Request a fresh preview." });
    }
    const approval = yield* Effect.result(Effect.tryPromise({ try: () => deps.wallets.approve(senderId, id), catch: errorMessage }));
    record = yield* readRecord;
    if (Result.isFailure(approval) && record.status === "awaiting-approval") {
      return yield* new StepFailed({ position, reason: approval.failure });
    }
  }

  if (record.status === "failed") return yield* new StepFailed({ position, reason: "Crossmint reports that the transaction failed before inclusion" });
  const hash = record.hash;
  if (!hash) return yield* new InclusionPending({ position });
  deps.journal.markStepSubmitted(intentId, position, hash);

  const outcome = yield* Effect.tryPromise({
    try: () => deps.verifyUserOperation({ hash, sender: record.sender, userOperationHash: record.userOperationHash }),
    catch: (error) => unsettled(error, hash),
  });
  if (outcome.status === "pending") return yield* new InclusionPending({ position, hash });
  if (outcome.status === "reverted") return yield* new Reverted({ position, hash: outcome.hash });
  deps.journal.markStepSucceeded(intentId, position, outcome.hash);
  return outcome.hash;
});

/**
 * Execute persisted steps in order. Each step is idempotent: Crossmint is
 * only asked to approve while the transaction still awaits approval, and a
 * step only counts as succeeded once the receipt carries a matching
 * UserOperationEvent whose inner success flag is set. Steps that already
 * succeeded contribute their hash and are not touched.
 */
export async function executeSteps(deps: StepExecutionDeps, request: StepExecutionRequest): Promise<StepsResult> {
  const program: Effect.Effect<string[], StepFailure> = Effect.gen(function* () {
    const hashes: string[] = [];
    for (const step of deps.journal.steps(request.intentId)) {
      if (step.state === "succeeded") {
        if (step.hash) hashes.push(step.hash);
        continue;
      }
      hashes.push(yield* executeStep(deps, request, step));
    }
    return hashes;
  });

  const exit = await Effect.runPromiseExit(program);
  return Exit.match(exit, {
    onSuccess: (hashes): StepsResult => ({ outcome: "succeeded", hashes }),
    onFailure: (cause): StepsResult => {
      const failure: Option.Option<StepFailure> = Cause.findErrorOption(cause);
      if (Option.isNone(failure)) throw Cause.squash(cause);
      switch (failure.value._tag) {
        case "StepFailed":
        case "Reverted":
          return { outcome: "failed", failure: failure.value };
        case "OutcomeUnknown":
        case "InclusionPending":
          return { outcome: "unsettled", failure: failure.value };
        default: {
          const _exhaustive: never = failure.value;
          throw new Error(`Unhandled step failure ${String(_exhaustive)}`);
        }
      }
    },
  });
}
