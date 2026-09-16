import { useCallback, useEffect, useRef, useState } from "react";
import { webStateSchema, type WebState } from "../../../../src/web-contract";
import { z } from "zod";
const errorSchema = z.object({ error: z.string() });
export async function request(path: string, body?: unknown) {
  const response = await fetch(`/aero/stocks/api/${path}`, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      errorSchema.safeParse(data).data?.error ??
        (response.status === 409
          ? "The agent is still processing your previous message. Retry shortly."
          : "Request failed. Please try again."),
    );
  return data;
}
type Retry = {
  requestId: string;
  text: string;
  retryOf?: string;
  answerTo?: string;
};
type ThreadState = {
  state: WebState | null;
  error: string;
  pending: boolean;
  retry: Retry | null;
  inFlight: string | null;
};
const EMPTY_THREAD: ThreadState = {
  state: null,
  error: "",
  pending: false,
  retry: null,
  inFlight: null,
};

export function useAccount(signedIn: boolean, threadId: string | null = null) {
  const [cache, setCache] = useState(
    () => new Map<string | null, ThreadState>(),
  );
  const [shared, setShared] = useState<Pick<
    WebState,
    "wallet" | "threads"
  > | null>(null);
  const generation = useRef(0);
  const loads = useRef(new Map<string | null, Promise<void>>());
  const sharedVersion = useRef(0);
  const requestVersion = useRef(0);
  const sends = useRef(new Set<string | null>());
  const update = useCallback(
    (id: string | null, patch: Partial<ThreadState>) => {
      setCache((current) =>
        new Map(current).set(id, {
          ...(current.get(id) ?? EMPTY_THREAD),
          ...patch,
        }),
      );
    },
    [],
  );
  const load = useCallback(
    (id: string | null, force = false): Promise<void> => {
      if (!signedIn) return Promise.resolve();
      const existing = loads.current.get(id);
      if (existing && !force) return existing;
      const epoch = generation.current;
      const version = ++requestVersion.current;
      const query = id ? `?t=${encodeURIComponent(id)}` : "";
      const promise = request(`state${query}`)
        .then((data) => {
          if (epoch !== generation.current || loads.current.get(id) !== promise)
            return;
          const state = webStateSchema.parse(data);
          update(id, { state, error: "" });
          if (version >= sharedVersion.current) {
            sharedVersion.current = version;
            setShared({ wallet: state.wallet, threads: state.threads });
          }
        })
        .finally(() => {
          if (loads.current.get(id) === promise) loads.current.delete(id);
        });
      loads.current.set(id, promise);
      return promise;
    },
    [signedIn, update],
  );
  const reload = useCallback(() => load(threadId, true), [load, threadId]);
  const prefetch = useCallback(
    (id: string | null) => {
      if (!cache.get(id)?.state) void load(id).catch(() => {});
    },
    [cache, load],
  );
  useEffect(() => {
    if (!signedIn) {
      generation.current++;
      loads.current.clear();
      sends.current.clear();
      setCache(new Map());
      setShared(null);
    }
    return () => {
      generation.current++;
      loads.current.clear();
    };
  }, [signedIn]);
  useEffect(() => {
    const epoch = generation.current;
    if (signedIn)
      void load(threadId).catch((e) => {
        if (generation.current === epoch)
          update(threadId, {
            error:
              e instanceof Error ? e.message : "Could not load this thread.",
          });
      });
  }, [signedIn, threadId, load, update]);
  useEffect(() => {
    if (!signedIn) return;
    for (const thread of shared?.threads?.slice(0, 6) ?? []) {
      if (thread.id !== threadId && !cache.get(thread.id)?.state)
        prefetch(thread.id);
    }
  }, [signedIn, shared?.threads, cache, threadId, prefetch]);
  const prepareNewThread = useCallback(
    (id: string) => {
      if (!shared) return;
      update(id, {
        state: {
          ...shared,
          threadId: id,
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
      update(threadId, {
        pending: true,
        error: "",
        retry: null,
        inFlight: retryOf ? null : text,
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
        await request("turn", {
          requestId,
          text,
          ...(retryOf ? { retryOf } : {}),
          ...(answerTo ? { answerTo } : {}),
          ...(threadId ? { threadId } : {}),
        });
        if (generation.current === epoch) await reload();
      } catch (e) {
        if (generation.current !== epoch) return;
        await reload().catch(() => {});
        if (generation.current === epoch)
          update(threadId, {
            error:
              e instanceof Error ? e.message : "Could not reach the agent.",
            retry: { requestId, text, retryOf, answerTo },
          });
      } finally {
        if (generation.current === epoch) {
          sends.current.delete(threadId);
          update(threadId, { pending: false, inFlight: null });
        }
      }
    },
    [signedIn, threadId, reload, update],
  );
  useEffect(() => {
    if (
      !signedIn ||
      current.pending ||
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
        loads.current.clear();
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
        await reload();
        return true;
      } catch (e) {
        if (generation.current === epoch)
          setError(
            e instanceof Error ? e.message : "Could not delete the thread.",
          );
        return false;
      }
    },
    [reload, setError],
  );
  return {
    state,
    loading,
    error: current.error,
    pending: current.pending,
    retry: current.retry,
    inFlight: current.inFlight,
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
