import type { ConfirmationState } from "../../src/components/ai-elements/confirmation";
import type { PlanStep, TransactionPlan } from "../../../../src/transaction-plan-contract";

/** Fictional plans shaped exactly like the backend decoder's output (see apps/pecu/tests/transaction-plan.test.ts). */
const swapper = "0xcAF22ce31298CF2BF1D152862F80216478ad7c67";
const permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const weth = "0x4200000000000000000000000000000000000006";
const positions = "0xe1f8cd9AC4e4A65F54f38a5CdAfCA44f6dD68b53";

const permitUsdc = (amount: string): PlanStep[] => [
  { kind: "approval", title: `Allow Permit2 to spend ${amount} USDC`, contract: usdc, contractName: "USDC token" },
  { kind: "approval", title: `Allow the Aerodrome swap router to spend ${amount} USDC through Permit2`, contract: permit2, contractName: "Permit2" },
];

export const transactionPlans = {
  swap: {
    steps: [{ kind: "swap", title: "Swap 0.05 ETH for at least 119.4 USDC", contract: swapper, contractName: "Aerodrome swap router", value: "0.05 ETH" }],
    route: {
      nodes: [{ id: "n0", kind: "token", label: "ETH" }, { id: "n1", kind: "token", label: "USDC" }],
      edges: [{ from: "n0", to: "n1", step: 0, label: "CL100" }],
    },
  },
  basket: {
    steps: [
      ...permitUsdc("200"),
      { kind: "swap", title: "Swap 100 USDC for at least 0.447967 NVDAc; 100 USDC for at least 0.294595 AAPLc", contract: swapper, contractName: "Aerodrome swap router" },
    ],
    route: {
      nodes: [{ id: "n0", kind: "token", label: "USDC" }, { id: "n1", kind: "token", label: "NVDAc" }, { id: "n2", kind: "token", label: "AAPLc" }],
      edges: [{ from: "n0", to: "n1", step: 2, label: "CL100" }, { from: "n0", to: "n2", step: 2, label: "CL100" }],
    },
  },
  multihop: {
    steps: [
      ...permitUsdc("50"),
      { kind: "swap", title: "Swap 50 USDC for at least 0.0004179 cbBTC via AERO", contract: swapper, contractName: "Aerodrome swap router" },
    ],
    route: {
      nodes: [{ id: "n0", kind: "token", label: "USDC" }, { id: "n1", kind: "token", label: "AERO" }, { id: "n2", kind: "token", label: "cbBTC" }],
      edges: [{ from: "n0", to: "n1", step: 2, label: "Volatile" }, { from: "n1", to: "n2", step: 2, label: "CL200" }],
    },
  },
  pool: {
    steps: [
      ...permitUsdc("25"),
      { kind: "swap", title: "Swap 25 USDC for at least 0.0098505 WETH", contract: swapper, contractName: "Aerodrome swap router" },
      { kind: "approval", title: "Allow the Aerodrome position manager to spend 0.0098 WETH", contract: weth, contractName: "WETH token" },
      { kind: "approval", title: "Allow the Aerodrome position manager to spend 25 USDC", contract: usdc, contractName: "USDC token" },
      { kind: "deposit", title: "Create a CL100 WETH/USDC pool and deposit 0.0098 WETH and 25 USDC", contract: positions, contractName: "Aerodrome position manager" },
    ],
    route: {
      nodes: [
        { id: "n0", kind: "token", label: "USDC" },
        { id: "n1", kind: "token", label: "WETH" },
        { id: "n2", kind: "pool", label: "New CL100 pool", detail: "WETH / USDC", created: true },
      ],
      edges: [
        { from: "n0", to: "n1", step: 2, label: "CL100" },
        { from: "n1", to: "n2", step: 5 },
        { from: "n0", to: "n2", step: 5 },
      ],
    },
  },
} satisfies Record<string, TransactionPlan>;

const hash = (index: number) => `0x${(index + 1).toString(16).padStart(2, "0").repeat(32)}`;

/**
 * Step progress for a fictional plan at a card state: part-way through while
 * executing, one failure followed by unsent steps when failed.
 */
export function planAt(plan: TransactionPlan, state: ConfirmationState): TransactionPlan {
  if (state === "pending" || state === "cancelled" || state === "expired") return plan;
  const last = plan.steps.length - 1;
  const failure = Math.min(2, last);
  const current = Math.max(0, last - 1);
  return {
    ...plan,
    steps: plan.steps.map((step, index): PlanStep => {
      if (state === "succeeded" || (state === "executing" && index < current) || (state === "failed" && index < failure)) {
        return { ...step, status: "confirmed", hash: hash(index) };
      }
      if (state === "executing") return { ...step, status: index === current ? "submitted" : "waiting", ...(index === current ? { hash: hash(index) } : {}) };
      return { ...step, status: index === failure ? "failed" : "skipped" };
    }),
  };
}
