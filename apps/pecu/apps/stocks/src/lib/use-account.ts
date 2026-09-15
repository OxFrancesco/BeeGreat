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
export function useAccount(signedIn: boolean) {
  const [state, setState] = useState<WebState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState<{
    requestId: string;
    text: string;
  } | null>(null);
  const reload = useCallback(async () => {
    if (!signedIn) return;
    setState(webStateSchema.parse(await request("state")));
  }, [signedIn]);
  useEffect(() => {
    setState(null);
    setRetry(null);
    setError("");
    if (signedIn) void reload().catch((e) => setError(e.message));
  }, [signedIn, reload]);
  const send = useCallback(
    async (text: string, requestId: string = crypto.randomUUID()) => {
      if (pending) return;
      setPending(true);
      setError("");
      setRetry(null);
      try {
        await request("turn", { requestId, text });
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reach the agent.");
        setRetry({ requestId, text });
        await reload().catch(() => {});
      } finally {
        setPending(false);
      }
    },
    [pending, reload],
  );
  return { state, error, pending, retry, reload, send, setError };
}
