import { useCallback, useEffect, useState } from "react";
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
/**
 * One web conversation with the Pecu agent. `threadId` selects a thread;
 * `null` is the original conversation the Stocks page has always used.
 */
export function useAccount(signedIn: boolean, threadId: string | null = null) {
  const [state, setState] = useState<WebState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<{
    requestId: string;
    text: string;
    retryOf?: string;
    answerTo?: string;
  } | null>(null);
  const reload = useCallback(async () => {
    if (!signedIn) return;
    const query = threadId ? `?t=${encodeURIComponent(threadId)}` : "";
    setState(webStateSchema.parse(await request(`state${query}`)));
  }, [signedIn, threadId]);
  useEffect(() => {
    setState(null);
    setRetry(null);
    setError("");
    if (signedIn) void reload().catch((e) => setError(e.message));
  }, [signedIn, reload]);
  const send = useCallback(
    async (
      text: string,
      requestId: string = crypto.randomUUID(),
      retryOf?: string,
      answerTo?: string,
    ) => {
      if (pending) return;
      setPending(true);
      setError("");
      setRetry(null);
      if (retryOf)
        setState((current) =>
          current
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  message.id === retryOf
                    ? { ...message, reply: null }
                    : message,
                ),
              }
            : current,
        );
      try {
        await request("turn", {
          requestId,
          text,
          ...(retryOf ? { retryOf } : {}),
          ...(answerTo ? { answerTo } : {}),
          ...(threadId ? { threadId } : {}),
        });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reach the agent.");
        setRetry({ requestId, text, retryOf, answerTo });
        await reload().catch(() => {});
      } finally {
        setPending(false);
      }
    },
    [pending, reload, threadId],
  );
  useEffect(() => {
    if (
      !signedIn ||
      pending ||
      !state?.messages.some((message) => !message.reply)
    )
      return;
    const timer = setInterval(() => {
      void reload().catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [signedIn, pending, state, reload]);
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
      setError("");
      try {
        await request("thread-delete", { threadId: target });
        await reload();
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not delete the thread.",
        );
        return false;
      }
    },
    [reload],
  );
  return {
    state,
    error,
    pending,
    retry,
    reload,
    send,
    answer,
    regenerate,
    deleteThread,
    setError,
  };
}
