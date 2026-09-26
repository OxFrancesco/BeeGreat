import { jsonValueSchema, type JsonInput } from "../../../../src/json-contract";
import { needsChatGptConnection } from "../../../../src/inference-recovery";
import { openChatGptConnection } from "./inference-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  webStateSchema,
  messagePageSchema,
  threadPageSchema,
  type MessagePageQuery,
  type ThreadPageQuery,
  type ThreadPage,
  type WebState,
} from "../../../../src/web-contract";
import { historyBytes, trimThreadCache } from "./thread-cache";
import {
  readSseEvents,
  sseContentType,
  timedTextContentType,
  webTurnEventSchema,
} from "../../../../src/web-stream";
import { z } from "zod";
import type { TurnStage } from "../../../../src/progress";
const errorSchema = z.object({ error: z.string() });
const busyMessage =
  "The agent is still processing your previous message. Retry shortly.";
async function failed(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  return new Error(
    errorSchema.safeParse(data).data?.error ??
      (response.status === 409 ? busyMessage : "Request failed. Please try again."),
  );
}
export async function request(
  path: string,
  body?: JsonInput,
  signal?: AbortSignal,
) {
  const init: RequestInit = { signal };
  if (body !== undefined) {
    init.method = "POST";
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`/stocks/api/${path}`, init);
  if (!response.ok) throw await failed(response);
  return jsonValueSchema.parse(await response.json());
}
/**
 * Sends a turn and reports live Markdown snapshots, or legacy finished paragraphs.
 * A backend that answers with plain JSON (older deploy, deterministic
 * command) resolves the same way with no paragraphs.
 */
export async function streamTurn(
  body: JsonInput,
  onParagraph: (text: string, replace: boolean) => void,
  onStage?: (stage: TurnStage) => void,
): Promise<void> {
  const startedAt = performance.now();
  let traceId: string | undefined;
  let firstAnswer = false;
  const metric = (name: "first_frame" | "first_answer_render" | "complete", at = performance.now()) => {
    if (!traceId) return;
    const id = traceId;
    void import("../../../../src/browser-analytics").then(({ trackTurnPerformance }) => trackTurnPerformance(id, name, at - startedAt)).catch(() => {});
  };
  const response = await fetch("/stocks/api/turn", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `${timedTextContentType}, application/json`,
    },
    body: JSON.stringify(body),
  }).catch(() => { throw new Error("The connection to Pecu dropped. Check for a reply below, or retry this same request."); });
  if (!response.ok) throw await failed(response);
  if (!response.headers.get("Content-Type")?.includes(sseContentType) || !response.body) {
    await response.json();
    return;
  }
  for await (const raw of readSseEvents(response.body)) {
    const event = webTurnEventSchema.parse(raw);
    if (event.type === "paragraph") {
      onParagraph(event.text, event.replace === true);
      if (!firstAnswer) {
        firstAnswer = true;
        if (traceId && typeof requestAnimationFrame === "function")
          requestAnimationFrame(() => requestAnimationFrame(() => metric("first_answer_render")));
      }
    }
    else if (event.type === "trace") { traceId = event.traceId; metric("first_frame"); }
    else if (event.type === "stage") onStage?.(event.stage);
    else if (event.type === "error") throw new Error(event.error);
    else if (event.status === "busy") throw new Error(busyMessage);
    else { metric("complete"); return; }
  }
  throw new Error(
    "The connection to Pecu dropped. Check for a reply below, or retry this same request.",
  );
}
type Retry = {
  requestId: string;
  text: string;
  retryOf?: string;
  answerTo?: string;
};
type ThreadState = {
  state: WebState | null;
  bytes: number;
  page: MessagePageQuery;
  paging: boolean;
  error: string;
  pending: boolean;
  retry: Retry | null;
  inFlight: string | null;
  /** Paragraphs of the reply being written right now; cleared once the turn completes. */
  partial: readonly string[];
  stages: readonly TurnStage[];
};
const EMPTY_THREAD: ThreadState = {
  state: null,
  bytes: 0,
  page: {},
  paging: false,
  error: "",
  pending: false,
  retry: null,
  inFlight: null,
  partial: [],
  stages: [],
};

export function useAccount(signedIn: boolean, threadId: string | null = null) {
  const [cache, setCache] = useState(
    () => new Map<string | null, ThreadState>(),
  );
  const [shared, setShared] = useState<Pick<
    WebState,
    "wallet" | "threads"
  > | null>(null);
  const [threadPage, setThreadPage] = useState<ThreadPage>({
    threads: [],
    olderCursor: null,
    newerCursor: null,
  });
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [threadsError, setThreadsError] = useState("");
  const generation = useRef(0);
  const active = useRef(threadId);
  active.current = threadId;
  const cacheRef = useRef(cache);
  cacheRef.current = cache;
  const loads = useRef(
    new Map<
      string | null,
      { promise: Promise<WebState | void>; controller: AbortController }
    >(),
  );
  const threadLoad = useRef<AbortController | null>(null);
  const recoveryRequests = useRef(new Set<string>());
  const sends = useRef(new Set<string | null>());
  const update = useCallback(
    (id: string | null, patch: Partial<ThreadState>) => {
      setCache((current) => {
        const next = new Map(current);
        const entry = { ...(next.get(id) ?? EMPTY_THREAD), ...patch };
        if (patch.state !== undefined) entry.bytes = historyBytes(patch.state);
        next.delete(id);
        next.set(id, entry);
        return trimThreadCache(next, active.current);
      });
    },
    [],
  );
  const loadThreads = useCallback(
    async (page: ThreadPageQuery = {}) => {
      if (!signedIn) return;
      threadLoad.current?.abort();
      const controller = new AbortController();
      threadLoad.current = controller;
      const epoch = generation.current;
      setThreadsLoading(true);
      setThreadsError("");
      try {
        const result = threadPageSchema.parse(
          await request(
            `threads${pageQuery(page)}`,
            undefined,
            controller.signal,
          ),
        );
        if (epoch !== generation.current || controller.signal.aborted) return;
        setThreadPage(result);
        setThreadsLoaded(true);
        setShared((current) => ({
          wallet: current?.wallet ?? null,
          threads: result.threads,
        }));
      } catch (error) {
        if (epoch === generation.current && !controller.signal.aborted)
          setThreadsError(
            error instanceof Error ? error.message : "Could not load threads.",
          );
      } finally {
        if (threadLoad.current === controller) setThreadsLoading(false);
      }
    },
    [signedIn],
  );
  const load = useCallback(
    (
      id: string | null,
      force = false,
      page: MessagePageQuery = {},
    ): Promise<WebState | void> => {
      if (!signedIn) return Promise.resolve();
      const existing = loads.current.get(id);
      if (existing && !force) return existing.promise;
      existing?.controller.abort();
      const controller = new AbortController();
      const epoch = generation.current;
      const previous = cacheRef.current.get(id)?.state;
      const historyOnly = Boolean(previous && (page.before || page.after));
      const query = pageQuery(page, id, !historyOnly);
      const promise = request(
        `${historyOnly ? "messages" : "state"}${query}`,
        undefined,
        controller.signal,
      )
        .then((data) => {
          if (epoch !== generation.current || controller.signal.aborted) return;
          const state = historyOnly
            ? { ...previous!, ...messagePageSchema.parse(data) }
            : webStateSchema.parse(data);
          for (const message of state.messages) {
            const requestId = message.id.split(":").at(-1)!;
            if (!message.reply || !recoveryRequests.current.has(requestId)) continue;
            recoveryRequests.current.delete(requestId);
            if (id === active.current && needsChatGptConnection(message.reply)) openChatGptConnection();
          }
          // Summaries are fetched separately and never duplicated into each history.
          const { threads: _threads, ...history } = state;
          update(id, { state: history, error: "", page, paging: false });
          setShared((current) => ({
            wallet: state.wallet,
            threads: current?.threads ?? [],
          }));
          return state;
        })
        .finally(() => {
          if (loads.current.get(id)?.promise === promise)
            loads.current.delete(id);
        });
      loads.current.set(id, { promise, controller });
      return promise;
    },
    [signedIn, update],
  );
  const reload = useCallback(async () => { await load(threadId, true); }, [load, threadId]);
  const pageMessages = useCallback(
    async (page: MessagePageQuery = {}) => {
      const epoch = generation.current;
      update(threadId, { paging: true, error: "" });
      try {
        await load(threadId, true, page);
      } catch (error) {
        if (epoch === generation.current)
          update(threadId, {
            paging: false,
            error:
              error instanceof Error && error.name === "AbortError"
                ? ""
                : error instanceof Error
                  ? error.message
                  : "Could not load messages.",
          });
      }
    },
    [threadId, load, update],
  );
  const prefetch = useCallback(
    (id: string | null) => {
      if (cacheRef.current.get(id)?.state || loads.current.size >= 2) return;
      void load(id).catch(() => {});
    },
    [load],
  );
  useEffect(() => {
    if (!signedIn) {
      generation.current++;
      sends.current.clear();
      recoveryRequests.current.clear();
      setCache(new Map());
      setShared(null);
      setThreadsLoaded(false);
      setThreadPage({ threads: [], olderCursor: null, newerCursor: null });
    } else void loadThreads();
    return () => {
      generation.current++;
      for (const { controller } of loads.current.values()) controller.abort();
      loads.current.clear();
      threadLoad.current?.abort();
    };
  }, [signedIn, loadThreads]);
  useEffect(() => {
    const epoch = generation.current;
    if (!signedIn) return;
    // Keep the selected history immediately. Cancel obsolete reads on rapid switches.
    for (const [id, entry] of loads.current) {
      if (id !== threadId && !sends.current.has(id)) {
        entry.controller.abort();
        loads.current.delete(id);
      }
    }
    const cached = cacheRef.current.get(threadId);
    if (cached?.state) {
      update(threadId, {});
      void load(threadId, false, cached.page).catch(() => {});
      return;
    }
    void load(threadId).catch((error) => {
      if (
        generation.current === epoch &&
        active.current === threadId &&
        error?.name !== "AbortError"
      )
        update(threadId, {
          error:
            error instanceof Error
              ? error.message
              : "Could not load this thread.",
        });
    });
  }, [signedIn, threadId, load, update]);
  const prepareNewThread = useCallback(
    (id: string) => {
      if (!shared) return;
      update(id, {
        state: {
          wallet: shared.wallet,
          threadId: id,
          olderCursor: null,
          newerCursor: null,
          yolo: false,
          messages: [],
          stocks: null,
          stocksAt: null,
          basket: null,
        },
      });
    },
    [shared, update],
  );
  const current = signedIn
    ? (cache.get(threadId) ?? EMPTY_THREAD)
    : EMPTY_THREAD;
  const state = current.state
    ? { ...current.state, ...shared }
    : signedIn && shared
      ? {
          ...shared,
          threadId,
          yolo: false,
          messages: [],
          stocks: null,
          stocksAt: null,
          basket: null,
        }
      : null;
  const loading = signedIn && !current.state;
  const setError = useCallback(
    (error: string) => update(threadId, { error }),
    [threadId, update],
  );
  const send = useCallback(
    async (
      text: string,
      requestId: string = crypto.randomUUID(),
      retryOf?: string,
      answerTo?: string,
    ) => {
      if (!signedIn || sends.current.has(threadId)) return;
      const epoch = generation.current;
      sends.current.add(threadId);
      recoveryRequests.current.add(requestId);
      if (cacheRef.current.get(threadId)?.state?.newerCursor)
        void load(threadId, true).catch(() => {});
      update(threadId, {
        pending: true,
        error: "",
        retry: null,
        inFlight: retryOf ? null : text,
        partial: [],
  stages: [],
      });
      if (retryOf)
        setCache((current) => {
          const entry = current.get(threadId);
          if (!entry?.state) return current;
          return new Map(current).set(threadId, {
            ...entry,
            state: {
              ...entry.state,
              messages: entry.state.messages.map((message) =>
                message.id === retryOf ? { ...message, reply: null } : message,
              ),
            },
          });
        });
      try {
        await streamTurn(
          {
            requestId,
            text,
            retryOf: retryOf || undefined,
            answerTo: answerTo || undefined,
            threadId: threadId || undefined,
          },
          (paragraph, replace) => {
            if (generation.current !== epoch) return;
            setCache((current) => {
              const entry = current.get(threadId);
              if (!entry?.pending) return current;
              return new Map(current).set(threadId, {
                ...entry,
                partial: replace ? [paragraph] : [...entry.partial, paragraph],
              });
            });
          },
          stage => {
            if (generation.current !== epoch) return;
            setCache(current => {
              const entry = current.get(threadId);
              if (!entry?.pending) return current;
              return new Map(current).set(threadId, { ...entry,
                stages: [...entry.stages.filter(item => item.id !== stage.id), stage].slice(-50),
              });
            });
          },
        );
        if (generation.current === epoch) {
          await reload();
          void loadThreads();
        }
      } catch (e) {
        if (generation.current !== epoch) return;
        const recovered = await load(threadId, true).catch(() => undefined);
        if (recovered?.messages.some((message) => message.id.endsWith(`:${requestId}`) && message.reply)) {
          update(threadId, { error: "", retry: null });
          return;
        }
        if (generation.current === epoch)
          update(threadId, {
            error:
              e instanceof Error ? e.message : "Could not reach the agent.",
            retry: { requestId, text, retryOf, answerTo },
          });
      } finally {
        if (generation.current === epoch) {
          sends.current.delete(threadId);
          update(threadId, { pending: false, inFlight: null, partial: [] });
        }
      }
    },
    [signedIn, threadId, reload, update, loadThreads, load],
  );
  useEffect(() => {
    if (
      !signedIn ||
      current.pending ||
      current.state?.newerCursor ||
      !current.state?.messages.some((message) => !message.reply)
    )
      return;
    const timer = setInterval(() => {
      void load(threadId).catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [signedIn, current, load, threadId]);
  const answer = useCallback(
    (messageId: string, option: string) =>
      send(option, crypto.randomUUID(), undefined, messageId),
    [send],
  );
  const regenerate = useCallback(
    (message: WebState["messages"][number]) =>
      send(message.text, crypto.randomUUID(), message.id),
    [send],
  );
  const deleteThread = useCallback(
    async (target: string | null) => {
      const epoch = generation.current;
      setError("");
      try {
        await request("thread-delete", { threadId: target });
        if (generation.current !== epoch) return false;
        loads.current.get(target)?.controller.abort();
        loads.current.delete(target);
        setCache((current) => {
          const next = new Map(current);
          next.delete(target);
          return next;
        });
        setShared((current) =>
          current
            ? {
                ...current,
                threads: current.threads?.filter(
                  (thread) => thread.id !== target,
                ),
              }
            : current,
        );
        await Promise.all([reload(), loadThreads()]);
        return true;
      } catch (e) {
        if (generation.current === epoch)
          setError(
            e instanceof Error ? e.message : "Could not delete the thread.",
          );
        return false;
      }
    },
    [reload, setError, loadThreads],
  );
  return {
    state,
    loading,
    paging: current.paging,
    pageMessages,
    atLatest: !current.state?.newerCursor,
    threadPage,
    threadsLoading,
    threadsLoaded,
    threadsError,
    loadThreads,
    error: current.error,
    pending: current.pending,
    retry: current.retry,
    unsent: current.retry && !current.state?.messages.some((message) => message.id.endsWith(`:${current.retry!.requestId}`)) ? current.retry.text : null,
    inFlight: current.inFlight,
    partial: current.partial,
    stages: current.stages,
    reload,
    prefetch,
    prepareNewThread,
    send,
    answer,
    regenerate,
    deleteThread,
    setError,
  };
}

function pageQuery(
  page: MessagePageQuery | ThreadPageQuery,
  id?: string | null,
  paged = false,
) {
  const query = new URLSearchParams();
  if (id) query.set("t", id);
  if (paged) query.set("paged", "1");
  if (page.before) query.set("before", JSON.stringify(page.before));
  if (page.after) query.set("after", JSON.stringify(page.after));
  return query.size ? `?${query}` : "";
}
