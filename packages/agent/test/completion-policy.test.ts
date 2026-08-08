import { describe, expect, test } from "bun:test";

import { completionAuditSignal } from "../src/shared/completion-policy.ts";

describe("Bee completion policy", () => {
  test("continues a delegated multi-step request before settling", () => {
    expect(
      completionAuditSignal(
        {
          kind: "user",
          body: "Withdraw the pool and swap everything to ETH",
        },
        [{ tool: "task", isError: false }],
      ),
    ).toMatchObject({
      kind: "signal",
      type: "bee.completion_audit",
    });
  });

  test("audits a Web3 settlement continuation even if Bee tried to stop", () => {
    expect(
      completionAuditSignal(
        {
          kind: "signal",
          type: "web3.action_settled",
          body: "Withdrawal executed",
          attributes: {
            continuation: "Swap all received USDC to ETH.",
          },
        },
        [],
      ),
    ).toBeDefined();
  });

  test("does not add another turn to a final Web3 settlement", () => {
    expect(
      completionAuditSignal(
        {
          kind: "signal",
          type: "web3.action_settled",
          body: "Swap executed",
        },
        [],
      ),
    ).toBeUndefined();
  });

  test("does not add latency to a completed single-step read", () => {
    expect(
      completionAuditSignal({ kind: "user", body: "How much ETH do I have?" }, [
        { tool: "task", isError: false },
      ]),
    ).toBeUndefined();
  });

  test("keeps a scheduled Job alive until its run ledger is settled", () => {
    const delivery = {
      kind: "signal" as const,
      type: "job.scheduled",
      body: "Run the Job",
      attributes: { runId: "run_1" },
    };
    expect(completionAuditSignal(delivery, [])).toBeDefined();
    expect(
      completionAuditSignal(delivery, [
        { tool: "wait_for_agent_job_external", isError: false },
      ]),
    ).toBeUndefined();
    expect(
      completionAuditSignal(delivery, [
        { tool: "complete_agent_job_run", isError: false },
      ]),
    ).toBeUndefined();
    expect(
      completionAuditSignal(delivery, [
        { tool: "wait_for_agent_job_external", isError: false },
      ]),
    ).toBeUndefined();
  });

  test("settles the Job after its Web3 action finishes", () => {
    const delivery = {
      kind: "signal" as const,
      type: "web3.action_settled",
      body: "Claim executed",
      attributes: { jobRunId: "run_1" },
    };
    expect(completionAuditSignal(delivery, [])).toBeDefined();
    expect(
      completionAuditSignal(delivery, [
        { tool: "complete_agent_job_run", isError: false },
      ]),
    ).toBeUndefined();
    expect(
      completionAuditSignal(delivery, [
        { tool: "wait_for_agent_job_external", isError: false },
      ]),
    ).toBeUndefined();
  });

  test("does not loop or continue after Bee asks the user", () => {
    expect(
      completionAuditSignal(
        {
          kind: "signal",
          type: "bee.completion_audit",
          body: "Check completion",
        },
        [{ tool: "task", isError: false }],
      ),
    ).toBeUndefined();
    expect(
      completionAuditSignal(
        { kind: "user", body: "Create it and publish it" },
        [
          { tool: "task", isError: false },
          { tool: "question", isError: false },
        ],
      ),
    ).toBeUndefined();
  });
});
