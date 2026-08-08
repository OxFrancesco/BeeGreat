type Delivery =
  | { kind: "user"; body: string }
  | {
      kind: "signal";
      type: string;
      body: string;
      attributes?: Record<string, string>;
    };

type ResponseToolCall = { tool: string; isError: boolean };

const AUDIT_SIGNAL_TYPE = "bee.completion_audit";
const FOLLOW_UP_ACTION =
  /\b(?:and|then)\s+(?:bridge|complete|convert|create|delete|deploy|deposit|move|publish|run|send|stake|swap|transfer|unstake|update|withdraw)\b/i;
const MULTI_STEP_LANGUAGE =
  /\b(?:after(?:wards)?|everything|followed by|once|the entire|the whole|until)\b/i;

/**
 * Returns the one bounded continuation signal Bee needs before settling a
 * delegated multi-step response. Straightforward reads stay on the fast path.
 */
export function completionAuditSignal(
  delivery: Delivery,
  toolCalls: readonly ResponseToolCall[],
) {
  if (
    (delivery.kind === "signal" && delivery.type === AUDIT_SIGNAL_TYPE) ||
    toolCalls.some(({ tool, isError }) => tool === "question" && !isError)
  ) {
    return undefined;
  }

  const tasks = toolCalls.filter(({ tool }) => tool === "task");
  const isScheduledJob =
    delivery.kind === "signal" && delivery.type === "job.scheduled";
  if (
    isScheduledJob &&
    !toolCalls.some(
      ({ tool, isError }) =>
        (tool === "complete_agent_job_run" ||
          tool === "wait_for_agent_job_external") &&
        !isError,
    )
  ) {
    return {
      kind: "signal" as const,
      type: AUDIT_SIGNAL_TYPE,
      body: "This scheduled Job is not settled yet. Finish its instruction, perform any requested Telegram delivery, then call complete_agent_job_run exactly once with the truthful outcome.",
    };
  }
  const isWeb3Settlement =
    delivery.kind === "signal" && delivery.type === "web3.action_settled";
  if (
    isWeb3Settlement &&
    delivery.attributes?.jobRunId &&
    !toolCalls.some(
      ({ tool, isError }) =>
        (tool === "complete_agent_job_run" ||
          tool === "wait_for_agent_job_external") &&
        !isError,
    )
  ) {
    return {
      kind: "signal" as const,
      type: AUDIT_SIGNAL_TYPE,
      body: "This Web3 settlement belongs to a scheduled Job. Report its truthful final outcome, perform requested Telegram delivery, and call complete_agent_job_run exactly once.",
    };
  }
  const hasWeb3Continuation =
    isWeb3Settlement && Boolean(delivery.attributes?.continuation?.trim());
  const isExplicitMultiStepRequest =
    delivery.kind === "user" &&
    (FOLLOW_UP_ACTION.test(delivery.body) ||
      MULTI_STEP_LANGUAGE.test(delivery.body));
  const mustAudit =
    hasWeb3Continuation ||
    tasks.some(({ isError }) => isError) ||
    tasks.length > 1 ||
    (tasks.length > 0 && (isWeb3Settlement || isExplicitMultiStepRequest));
  if (!mustAudit) return undefined;

  return {
    kind: "signal" as const,
    type: AUDIT_SIGNAL_TYPE,
    body: [
      "Completion gate: compare the user’s full requested outcome with what has actually completed.",
      "If an already-authorized step remains and an available tool can advance it, continue now.",
      "If essential information is missing, call the question tool with the smallest useful choice.",
      "Stop only when the outcome is fulfilled, an external action has failed/cancelled, or an already-started settlement/signature is genuinely pending.",
      "Never say “when you are ready” for a step the user already requested.",
    ].join(" "),
  };
}
