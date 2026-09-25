import type { JsonInput } from "../../../src/json-contract";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAccount } from "../src/lib/use-account";
import type { WebState } from "../../../src/web-contract";
import { sseFrame } from "../../../src/web-stream";

let root: Root;
let account: ReturnType<typeof useAccount>;
let requests: { url: string; body?: BodyInit | null; resolve: (response: Response) => void; reject: (error: Error) => void }[];
const originalFetch = globalThis.fetch;
const state = (threadId: string | null): WebState => ({
  threadId,
  wallet: "0x1234",
  yolo: threadId === null,
  threads: [null, "aaaaaaaa", "bbbbbbbb"].map((id) => ({
    id,
    title: id ?? "First",
    count: 1,
    createdAt: 1,
    updatedAt: 1,
  })),
  messages: [
    {
      id: threadId ?? "first",
      text: threadId ?? "First",
      createdAt: 1,
      reply: { text: "Reply", preview: null },
    },
  ],
  stocks: null,
  stocksAt: null,
  basket: null,
});
function Probe({
  threadId,
  signedIn,
}: {
  threadId: string | null;
  signedIn: boolean;
}) {
  account = useAccount(signedIn, threadId);
  return null;
}
const render = async (threadId: string | null, signedIn = true) => {
  await act(async () =>
    root.render(<Probe threadId={threadId} signedIn={signedIn} />),
  );
};
const respond = async (index: number, data: JsonInput) => {
  await act(async () => requests[index]!.resolve(Response.json(data)));
};
beforeEach(() => {
  const window = new Window();
  Object.assign(globalThis, {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  window.document.write("<!doctype html><html><body></body></html>");
  requests = [];
  globalThis.fetch = Object.assign((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/threads"))
      return Promise.resolve(
        Response.json({
          threads: state(null).threads,
          olderCursor: null,
          newerCursor: null,
        }),
      );
    return new Promise<Response>((resolve, reject) => requests.push({ url, body: init?.body, resolve, reject }));
  }, { preconnect: originalFetch.preconnect });
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
});

test.each([true, false])("partial replies update before completion and survive until history loads, live=%s", async (live) => {
  await render(null);
  await respond(0, state(null));
  let sending!: Promise<void>;
  await act(async () => { sending = account.send("Explain pools", "stream-request"); });
  const turn = requests.findIndex((r) => r.url.endsWith("/turn"));
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  await act(async () => { requests[turn]!.resolve(new Response(stream.readable, { headers: { "Content-Type": "text/event-stream" } })); });
  const marker = live ? { replace: true as const } : {};
  await act(async () => { await writer.write(encoder.encode(sseFrame({ type: "paragraph", text: "First", ...marker }))); });
  expect(account.pending).toBe(true);
  expect(account.partial).toEqual(["First"]);
  await act(async () => { await writer.write(encoder.encode(sseFrame({ type: "paragraph", text: live ? "First sentence.\n\nLast paragraph." : "Last paragraph.", ...marker }))); });
  expect(account.partial).toEqual(live ? ["First sentence.\n\nLast paragraph."] : ["First", "Last paragraph."]);
  await act(async () => { await writer.write(encoder.encode(sseFrame({ type: "complete", status: "complete" }))); await writer.close(); });
  expect(account.partial.length).toBeGreaterThan(0);
  await respond(requests.findLastIndex((r) => r.url.includes("/state")), state(null));
  await act(async () => { await sending; });
  expect(account.pending).toBe(false);
  expect(account.partial).toEqual([]);
});

test("a disconnected submission keeps its text and reuses its request ID", async () => {
  await render(null);
  await respond(0, state(null));
  let sending!: Promise<void>;
  await act(async () => { sending = account.send("Check my allowance", "same-request"); });
  const turn = requests.findIndex((r) => r.url.endsWith("/turn"));
  await act(async () => requests[turn]!.reject(new TypeError("Failed to fetch")));
  await respond(requests.findLastIndex((r) => r.url.includes("/state")), state(null));
  await act(async () => { await sending; });
  expect(account.unsent).toBe("Check my allowance");
  expect(account.error).toContain("connection to Pecu dropped");
  expect(account.retry?.requestId).toBe("same-request");
  await act(async () => { sending = account.send(account.retry!.text, account.retry!.requestId); });
  const retry = requests.findLastIndex((r) => r.url.endsWith("/turn"));
  expect(JSON.parse(String(requests[retry]!.body)).requestId).toBe("same-request");
  await respond(retry, {});
  await respond(requests.findLastIndex((r) => r.url.includes("/state")), state(null));
  await act(async () => { await sending; });
  expect(account.unsent).toBeNull();
});

test("reports when the thread list has loaded so the workspace can land on the latest thread", async () => {
  await render(null, false);
  expect(account.threadsLoaded).toBe(false);
  await render(null);
  expect(account.threadsLoaded).toBe(true);
  expect(account.threadPage.threads[0]?.id).toBeNull();
  await render(null, false);
  expect(account.threadsLoaded).toBe(false);
});

test("keeps account chrome while loading another thread without showing its predecessor's messages or YOLO", async () => {
  await render(null);
  await respond(0, state(null));
  await render("aaaaaaaa");
  expect(account.state?.threads).toEqual(state(null).threads);
  expect(account.state?.wallet).toBe("0x1234");
  expect(account.state?.messages).toEqual([]);
  expect(account.state?.yolo).toBe(false);
});

test("revisiting a thread renders cached history before the network responds", async () => {
  await render(null);
  await respond(0, state(null));
  await render("aaaaaaaa");
  await respond(
    requests.findIndex((r) => r.url.includes("t=aaaaaaaa")),
    state("aaaaaaaa"),
  );
  await render(null);
  expect(account.state?.messages[0]?.id).toBe("first");
});

test("a late history response cannot replace the selected thread", async () => {
  await render(null);
  await respond(0, state(null));
  await render("aaaaaaaa");
  const a = requests.findIndex((r) => r.url.includes("t=aaaaaaaa"));
  await render("bbbbbbbb");
  const b = requests.findIndex((r) => r.url.includes("t=bbbbbbbb"));
  await respond(b, state("bbbbbbbb"));
  await respond(a, state("aaaaaaaa"));
  expect(account.state?.messages[0]?.id).toBe("bbbbbbbb");
});

test("a pending reply and its completion stay with the originating thread", async () => {
  await render(null);
  await respond(0, state(null));
  let sending: Promise<void>;
  await act(async () => {
    sending = account.send("hello", "request-one");
  });
  const turn = requests.findIndex((r) => r.url.endsWith("/turn"));
  expect(account.pending).toBe(true);
  await render("aaaaaaaa");
  expect(account.pending).toBe(false);
  expect(account.inFlight).toBe(null);
  await respond(
    requests.findIndex((r) => r.url.includes("t=aaaaaaaa")),
    state("aaaaaaaa"),
  );
  await respond(turn, {});
  await respond(
    requests.findLastIndex((r) => r.url.endsWith("/state?paged=1")),
    state(null),
  );
  await act(async () => {
    await sending!;
  });
  expect(account.state?.threadId).toBe("aaaaaaaa");
  expect(account.state?.messages[0]?.id).toBe("aaaaaaaa");
  await render(null);
  expect(account.pending).toBe(false);
  expect(account.inFlight).toBe(null);
});

test("signing out discards history and ignores outstanding requests", async () => {
  await render(null);
  await respond(0, state(null));
  await render("aaaaaaaa");
  const a = requests.findIndex((r) => r.url.includes("t=aaaaaaaa"));
  await render("aaaaaaaa", false);
  await respond(a, state("aaaaaaaa"));
  expect(account.state).toBe(null);
  await render(null);
  expect(account.state?.messages ?? []).toEqual([]);
});

test("new threads are empty immediately without borrowing another thread's YOLO setting", async () => {
  await render(null);
  await respond(0, state(null));
  await act(async () => account.prepareNewThread("cccccccc"));
  await render("cccccccc");
  expect(account.loading).toBe(false);
  expect(account.state?.messages).toEqual([]);
  expect(account.state?.yolo).toBe(false);
});

test("newer reloads win when responses for the same thread arrive out of order", async () => {
  await render(null);
  let reload: Promise<void>;
  await act(async () => {
    reload = account.reload();
  });
  await respond(1, { ...state(null), messages: [] });
  await respond(0, state(null));
  await act(async () => {
    await reload!;
  });
  expect(account.state?.messages).toEqual([]);
});

test("history navigation keeps old content until its page arrives, then returns to latest", async () => {
  await render(null);
  const cursor = { at: 5, row: 5 };
  await respond(0, { ...state(null), olderCursor: cursor, newerCursor: null });
  let paging: Promise<void>;
  await act(async () => {
    paging = account.pageMessages({ before: cursor });
  });
  expect(account.paging).toBe(true);
  expect(account.state?.messages[0]?.id).toBe("first");
  expect(requests[1]?.url).toContain("/messages?");
  await respond(1, {
    messages: [{ ...state(null).messages[0], id: "older" }],
    olderCursor: null,
    newerCursor: cursor,
  });
  await act(async () => {
    await paging!;
  });
  expect(account.atLatest).toBe(false);
  expect(account.state?.messages[0]?.id).toBe("older");
  await act(async () => {
    paging = account.pageMessages();
  });
  await respond(2, { ...state(null), olderCursor: cursor, newerCursor: null });
  await act(async () => {
    await paging!;
  });
  expect(account.atLatest).toBe(true);
});

test("intent prefetch caps concurrent requests and does not fetch every sidebar thread", async () => {
  await render(null);
  await respond(0, state(null));
  expect(requests.length).toBe(1);
  await act(async () => {
    for (let i = 0; i < 100; i++) account.prefetch(`thread-${i}`);
  });
  expect(requests.length).toBe(3);
});

test("a fresh missing-connection reply opens ChatGPT settings once, but old history does not", async () => {
  await render(null);
  const old = state(null);
  old.messages[0]!.reply = { text: "Connect ChatGPT", preview: null, recovery: "connect_chatgpt" };
  await respond(0, old);
  expect(window.location.hash).toBe("");
  const requestId = crypto.randomUUID();
  let sending: Promise<void>;
  await act(async () => { sending = account.send("hello", requestId); });
  await respond(1, { status: "complete" });
  const next = state(null);
  next.messages = [{ id: `stocks:user:test:${requestId}`, text: "hello", createdAt: 2, reply: { text: "Connect ChatGPT", preview: null, recovery: "connect_chatgpt" } }];
  await respond(2, next);
  await act(async () => { await sending!; });
  expect(window.location.hash).toBe("#chatgpt");
  window.history.replaceState(null, "", "/");
  let reloading: Promise<void>;
  await act(async () => { reloading = account.reload(); });
  await respond(3, next);
  await act(async () => { await reloading!; });
  expect(window.location.hash).toBe("");
});
