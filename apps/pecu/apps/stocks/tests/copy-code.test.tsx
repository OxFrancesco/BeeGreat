import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LoginCode } from "../src/components/inference-profile";
let root: Root;
let host: HTMLDivElement;
let copied: string[];
let fail: boolean;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
beforeEach(() => {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
  copied = []; fail = false;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { if (fail) throw new Error("denied"); copied.push(value); } } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
});
test("copies just the displayed code and clears copied state for a new attempt", async () => {
  await act(async () => root.render(<LoginCode code="DEMO-1234" />));
  await act(async () => host.querySelector("button")!.click());
  expect(copied).toEqual(["DEMO-1234"]);
  expect(host.textContent).toContain("Copied");
  await act(async () => root.render(<LoginCode code="NEXT-5678" />));
  expect(host.querySelector("button")!.textContent).toBe("Copy code");
});
test("clipboard rejection keeps the code selectable and reports failure", async () => {
  fail = true;
  await act(async () => root.render(<LoginCode code="DEMO-1234" />));
  await act(async () => host.querySelector("button")!.click());
  expect(copied).toEqual([]);
  expect(host.querySelector("code")!.textContent).toBe("DEMO-1234");
  expect(host.textContent).toContain("Couldn't copy");
  expect(host.querySelector("button")!.textContent).toBe("Copy code");
});
