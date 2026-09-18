import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { useState, type KeyboardEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useCommandMenu } from "../src/lib/use-command-menu";

let root: Root;
let draft: string;
let menu: ReturnType<typeof useCommandMenu>;
let setDraft: (value: string) => void;

function Probe() {
  [draft, setDraft] = useState("");
  menu = useCommandMenu(draft, setDraft);
  return null;
}

function key(name: string) {
  let prevented = false;
  act(() =>
    menu.onKeyDown({
      key: name,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent),
  );
  return prevented;
}

async function type(value: string) {
  await act(async () => setDraft(value));
}

beforeEach(() => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.document.write("<!doctype html><html><body></body></html>");
  root = createRoot(document.createElement("div"));
});

afterEach(async () => {
  await act(async () => root.unmount());
});

test("typing a prefix lists matching commands", async () => {
  await act(async () => root.render(<Probe />));
  await type("/sto");
  expect(menu.items.map((item) => item.command)).toEqual(["/stocks"]);
  expect(menu.open).toBe(true);
});

test("a trailing space keeps subcommand suggestions open", async () => {
  await act(async () => root.render(<Probe />));
  await type("/yolo ");
  expect(menu.items.map((item) => item.command)).toEqual([
    "/yolo on",
    "/yolo off",
  ]);
  expect(menu.open).toBe(true);
});

test("a completed no-argument command closes the menu", async () => {
  await act(async () => root.render(<Probe />));
  await type("/stocks");
  expect(menu.open).toBe(false);
});

test("Escape dismisses the menu until the draft changes", async () => {
  await act(async () => root.render(<Probe />));
  await type("/st");
  expect(menu.open).toBe(true);
  expect(key("Escape")).toBe(true);
  expect(menu.open).toBe(false);
  await type("/sto");
  expect(menu.open).toBe(true);
});

test("ArrowDown then Enter accepts the second item", async () => {
  await act(async () => root.render(<Probe />));
  await type("/yolo ");
  key("ArrowDown");
  expect(menu.activeIndex).toBe(1);
  expect(key("Enter")).toBe(true);
  expect(draft).toBe("/yolo off");
});

test("accepting a command with arguments leaves the cursor ready", async () => {
  await act(async () => root.render(<Probe />));
  await type("/q");
  expect(menu.items.map((item) => item.command)).toEqual(["/quote"]);
  key("Enter");
  expect(draft).toBe("/quote ");
});
