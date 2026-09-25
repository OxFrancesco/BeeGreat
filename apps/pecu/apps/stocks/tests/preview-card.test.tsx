import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewCard } from "../src/components/preview-card";
import type { ConfirmationState } from "../src/components/ai-elements/confirmation";
import { planAt, transactionPlans } from "./fixtures/transaction-plans";
import { transactionPreviews } from "./fixtures/transaction-previews";

let root: Root;
let host: HTMLDivElement;
let commands: string[];
beforeEach(() => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  commands = [];
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(
  state: ConfirmationState = "pending",
  confirming = false,
  busy = false,
) {
  await act(async () =>
    root.render(
      <PreviewCard
        preview={{
          code: "ABC123",
          title: "Swap",
          state,
          expiresAt: 1_800_000_000_000,
          text: "Swap 0.05 ETH for about 120 USDC on Base.\nMinimum received: 119.40 USDC\nNetwork fee: not estimated yet.",
        }}
        confirming={confirming}
        busy={busy}
        onSend={async (text) => {
          commands.push(text);
        }}
      />,
    ),
  );
}
function button(label: string) {
  return Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === label,
  )!;
}

test("confirm and cancel bind to the exact preview code", async () => {
  await render();
  await act(async () => button("Confirm swap").click());
  await act(async () => button("Cancel").click());
  expect(commands).toEqual(["/confirm ABC123", "/cancel ABC123"]);
});
test("submitted previews can be checked but cannot be cancelled", async () => {
  await render("executing");
  expect(button("Cancel")).toBeUndefined();
  await act(async () => button("Check transaction").click());
  expect(commands).toEqual(["/confirm ABC123"]);
});
test("busy and confirming states prevent another submission", async () => {
  for (const [confirming, busy] of [
    [true, false],
    [false, true],
  ]) {
    await render("pending", confirming, busy);
    const actions = host.querySelectorAll<HTMLButtonElement>(
      ".pecu-confirmation-actions button",
    );
    expect([...actions].every((b) => b.disabled)).toBe(true);
    await act(async () => actions.forEach((b) => b.click()));
  }
  expect(commands).toEqual([]);
});
async function renderPlan(state: ConfirmationState) {
  await act(async () =>
    root.render(
      <PreviewCard
        preview={{ ...transactionPreviews[13]!, state, plan: planAt(transactionPlans.pool, state), result: "https://basescan.org/tx/0x" + "ab".repeat(32) }}
        confirming={false}
        busy={false}
        onSend={async () => {}}
      />,
    ),
  );
}

test("a plan lists every transaction in order and draws the route with matching numbers", async () => {
  await renderPlan("pending");
  const steps = [...host.querySelectorAll(".pecu-plan-step")];
  expect(steps.map((step) => step.querySelector(".pecu-plan-step-title")!.textContent)).toEqual(transactionPlans.pool.steps.map((step) => step.title));
  expect(steps.filter((step) => step.textContent!.includes("Permission only"))).toHaveLength(4);
  expect(host.querySelector(".pecu-plan-route")!.getAttribute("aria-label")).toContain("USDC to WETH through a CL100 pool, transaction 3");
  expect([...host.querySelectorAll(".is-across .pecu-plan-chip-step")].map((chip) => chip.textContent)).toEqual(["3", "6", "6"]);
  expect(host.querySelector(".is-across .pecu-plan-node.is-created")!.textContent).toBe("New CL100 poolWETH / USDC");
  expect(host.querySelector(".pecu-plan-step-status")).toBeNull();
});

test("pointing at a transaction highlights only the edges it moves", async () => {
  await renderPlan("pending");
  const swap = host.querySelector<HTMLElement>('.pecu-plan-step[data-step="2"]')!;
  await act(async () => swap.dispatchEvent(new window.PointerEvent("pointerover", { bubbles: true })));
  expect([...host.querySelectorAll(".is-across [data-active]")].map((item) => item.getAttribute("data-step"))).toEqual(["2", "2"]);
  await act(async () => swap.dispatchEvent(new window.PointerEvent("pointerout", { bubbles: true })));
  expect(host.querySelector(".is-across [data-active]")).toBeNull();
});

test("confirmed steps link their own receipts, so the card does not repeat the result links", async () => {
  await renderPlan("executing");
  expect([...host.querySelectorAll(".pecu-plan-step")].map((step) => step.getAttribute("data-status"))).toEqual(["confirmed", "confirmed", "confirmed", "confirmed", "submitted", "waiting"]);
  expect(host.querySelectorAll('.is-across .pecu-plan-edge[data-done]')).toHaveLength(1);
  await renderPlan("succeeded");
  expect(host.querySelectorAll('.pecu-plan-step a[href^="https://basescan.org/tx/"]')).toHaveLength(6);
  expect(host.querySelector(".pecu-confirmation-links")).toBeNull();
  await renderPlan("failed");
  expect([...host.querySelectorAll(".pecu-plan-step-status")].map((status) => status.textContent)).toEqual([
    expect.stringContaining("Confirmed on Base"), expect.stringContaining("Confirmed on Base"), "Failed", "Not sent", "Not sent", "Not sent",
  ]);
});

test("terminal states never show a transaction execution action", async () => {
  for (const state of [
    "succeeded",
    "failed",
    "expired",
    "cancelled",
  ] as const) {
    await render(state);
    expect(host.querySelector(".pecu-confirmation-actions")).toBeNull();
    expect(host.textContent).toContain("119.40 USDC");
    expect(host.textContent).toContain("Estimated receive");
  }
});
