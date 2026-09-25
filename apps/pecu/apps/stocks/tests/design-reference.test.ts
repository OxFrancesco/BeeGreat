import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { planSpecimens, transactionSpecimens } from "../../site/scripts/transaction-specimens";

const script = await Bun.file(new URL("../../site/site/pecu-assets/design.js", import.meta.url)).text();
let window: Window;

beforeEach(() => {
  window = new Window();
  window.document.body.innerHTML = `
    <div id="design-feedback"></div>
    <input id="component-search"><p id="empty-search"></p>
    <select id="preview-state">${["pending", "executing", "succeeded", "failed", "cancelled", "expired"].map((state) => `<option>${state}</option>`).join("")}</select>
    ${transactionSpecimens}
    ${planSpecimens}
    <form id="sample-composer"><textarea id="sample-message"></textarea></form><p id="sample-reply"></p>`;
  window.eval(script);
});

afterEach(async () => {
  await window.happyDOM.close();
});

function card(name = "swap") {
  return window.document.querySelector(`[data-sample-card="${name}"] [data-sample-content]`)!;
}

function selectState(state: string) {
  const select = window.document.querySelector<HTMLSelectElement>("#preview-state")!;
  select.value = state;
  select.dispatchEvent(new window.Event("change"));
}

test("design state selector shows real submitted and terminal content", () => {
  selectState("executing");
  expect(card().querySelector(".pecu-confirmation-actions")!.textContent).toBe("Check transaction");
  selectState("succeeded");
  expect(card().querySelector(".pecu-confirmation-actions")).toBeNull();
  expect(card().textContent).toContain("Receipt verified on Base");
  selectState("failed");
  expect(card().textContent).toContain("Sample error. Check transaction status before retrying.");
  for (const state of ["failed", "cancelled", "expired"]) {
    selectState(state);
    expect(card().querySelector(".pecu-confirmation-actions")).toBeNull();
  }
  selectState("pending");
  expect(card().querySelector(".pecu-confirmation-actions")!.textContent).toBe("Confirm swapCancel");
});

test("the plan state selector shows step progress, and pointing at a step highlights its edges", async () => {
  const select = window.document.querySelector<HTMLSelectElement>("#plan-state")!;
  const statuses = () => [...card("pool").querySelectorAll(".pecu-plan-step")].map((step) => step.getAttribute("data-status"));
  expect(statuses()).toEqual([null, null, null, null, null, null]);
  select.value = "failed";
  select.dispatchEvent(new window.Event("change"));
  expect(statuses()).toEqual(["confirmed", "confirmed", "failed", "skipped", "skipped", "skipped"]);
  const swap = card("pool").querySelector('.pecu-plan-step[data-step="2"]')!;
  swap.dispatchEvent(new window.Event("pointerover", { bubbles: true }));
  expect([...card("pool").querySelectorAll(".is-across [data-active]")].map((item) => item.getAttribute("data-step"))).toEqual(["2", "2"]);
  swap.dispatchEvent(new window.Event("pointerout", { bubbles: true }));
  expect(card("pool").querySelector("[data-active]")).toBeNull();
  const copied: string[] = [];
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async (text: string) => { copied.push(text); } }, configurable: true });
  card("pool").querySelector<HTMLButtonElement>(".pecu-plan-step-meta button")!.click();
  await Promise.resolve();
  expect(copied).toEqual(["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]);
});

test("all sample cards can confirm, check and cancel locally", () => {
  for (const name of ["swap", "approval", "basket", "pool", "multihop"]) {
    card(name).querySelector<HTMLButtonElement>(".pecu-confirmation-actions button")!.click();
    expect(card(name).querySelector(".pecu-confirmation-actions")!.textContent).toBe("Check transaction");
    card(name).querySelector<HTMLButtonElement>(".pecu-confirmation-actions button")!.click();
    expect(card(name).querySelector(".pecu-confirmation-actions")).toBeNull();
    expect(card(name).textContent).toContain("Receipt verified on Base");
  }
  selectState("pending");
  card().querySelector<HTMLButtonElement>(".pecu-confirmation-actions button:last-child")!.click();
  expect(card().querySelector(".pecu-confirmation")!.getAttribute("data-state")).toBe("cancelled");
  expect(card().querySelector(".pecu-confirmation-actions")).toBeNull();
});
