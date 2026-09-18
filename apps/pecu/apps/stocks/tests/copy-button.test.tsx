import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CopyButton } from "../src/components/copy-button";

let root: Root;
let host: HTMLDivElement;
let copied: string[];
let fail: boolean;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

beforeEach(() => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  copied = [];
  fail = false;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          if (fail) throw new Error("denied");
          copied.push(value);
        },
      },
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (originalNavigator)
    Object.defineProperty(globalThis, "navigator", originalNavigator);
});

test("copies the text and shows Copied only after the write resolves", async () => {
  await act(async () => root.render(<CopyButton text="Hello Pecu" />));
  await act(async () => host.querySelector("button")!.click());
  expect(copied).toEqual(["Hello Pecu"]);
  expect(host.textContent).toContain("Copied");
  expect(host.querySelector("svg")!.getAttribute("class")).toContain(
    "lucide-check",
  );
});

test("clipboard rejection keeps the copy icon and reports failure", async () => {
  fail = true;
  await act(async () => root.render(<CopyButton text="Hello Pecu" />));
  await act(async () => host.querySelector("button")!.click());
  expect(copied).toEqual([]);
  expect(host.textContent).toContain("Couldn't copy");
  expect(host.querySelector("svg")!.getAttribute("class")).toContain(
    "lucide-copy",
  );
});
