import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAccount } from "../src/lib/use-account";
import type { WebState } from "../../../src/web-contract";

let root: Root;
let account: ReturnType<typeof useAccount>;
let requests: { url: string; resolve: (response: Response) => void }[];
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
const respond = async (index: number, data: unknown) => {
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
  globalThis.fetch = ((url: string) => {
    if (url.includes("/threads"))
      return Promise.resolve(
        Response.json({
          threads: state(null).threads,
          olderCursor: null,
          newerCursor: null,
        }),
      );
    return new Promise<Response>((resolve) => requests.push({ url, resolve }));
  }) as typeof fetch;
  root = createRoot(document.createElement("div"));
});
afterEach(async () => {
  await act(async () => root.unmount());
  globalThis.fetch = originalFetch;
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
