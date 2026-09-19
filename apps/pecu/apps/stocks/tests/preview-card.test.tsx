import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviewCard } from "../src/components/preview-card";
import type { ConfirmationState } from "../src/components/ai-elements/confirmation";

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
