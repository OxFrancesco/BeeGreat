import { ownedWalletSchema, portfolioQuerySchema, portfolioSchema } from "../../../../src/portfolio-contract";
import { type JsonInput } from "../../../../src/json-contract";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { agentRequest, cardIdentity, identity, sameOrigin } from "../lib/server";
import { cardCollectionSchema } from "../../../../src/cards-contract";
import { linkedWalletActionSchema, linkedWalletResultSchema, linkedWalletsSchema } from "../../../../src/linked-wallet-contract";
import {
  profileActionResultSchema,
  profileActionSchema,
  profileOverviewSchema,
  profileSafeDetailSchema,
} from "../../../../src/safe-profile-contract";
import {
  basketSchema,
  threadIdSchema,
  messagePageQuerySchema,
  threadPageQuerySchema,
  inferenceStatusSchema,
  pnlDaysSchema,
  webPnlSchema,
} from "../../../../src/web-contract";
const turn = z
  .object({
    requestId: z.string().uuid(),
    retryOf: z.string().min(1).max(300).optional(),
    answerTo: z.string().min(1).max(300).optional(),
    text: z.string().trim().min(1).max(4000),
    threadId: threadIdSchema.optional(),
  })
  .strict();
const threadDelete = z.object({ threadId: threadIdSchema.nullable() }).strict();
const json = (body: JsonInput, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const Route = createFileRoute("/stocks/api/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (params._splat === "cards") return cardsRequest(false);
        if (params._splat === "portfolio") {
          const params = new URL(request.url).searchParams;
          const query = portfolioQuerySchema.safeParse({ tokens: params.getAll("token"), stocks: params.get("stocks") === "1", wallet: params.get("wallet") ?? undefined });
          if (!query.success) return json({ error: "Enter a token ticker or Base contract address." }, 400);
          return profileRequest("portfolio", portfolioSchema, query.data);
        }
        if (params._splat === "pnl") return pnlRequest(request);
        if (params._splat === "wallets") return walletRequest("wallets", linkedWalletsSchema);
        if (params._splat === "profile") return profileRequest("profile", profileOverviewSchema);
        if (params._splat === "profile-safe") {
          const safe = new URL(request.url).searchParams.get("safe") ?? "";
          if (!/^0x[0-9a-fA-F]{40}$/.test(safe)) return json({ error: "Check the Safe address." }, 400);
          return profileRequest("profile-safe", profileSafeDetailSchema, { safe });
        }
        if (params._splat === "inference") {
          let viewer;
          try {
            viewer = await identity();
          } catch {
            return json(
              { error: "Sign in to check Pecu's connection." },
              401,
            );
          }
          try {
            const response = await agentRequest("inference", viewer);
            if (!response.ok)
              return json(
                { error: "Could not check Pecu's connection. Try again." },
                503,
              );
            return json(inferenceStatusSchema.parse(await response.json()));
          } catch {
            return json(
              { error: "Could not check Pecu's connection. Try again." },
              503,
            );
          }
        }
        if (!["state", "messages", "threads"].includes(params._splat ?? ""))
          return json({ error: "Not found" }, 404);
        try {
          const thread = new URL(request.url).searchParams.get("t");
          const threadId = thread ? threadIdSchema.parse(thread) : undefined;
          const query = new URL(request.url).searchParams;
          const page = {
            before: query.has("before") ? JSON.parse(query.get("before")!) : undefined,
            after: query.has("after") ? JSON.parse(query.get("after")!) : undefined,
          };
          const viewer = await identity();
          if (params._splat === "threads")
            return await agentRequest("threads", {
              ...viewer,
              page: threadPageQuerySchema.parse(page),
            });
          if (params._splat === "messages")
            return await agentRequest("messages", {
              ...viewer,
              threadId,
              page: messagePageQuerySchema.parse(page),
            });
          return await agentRequest("state", {
            ...viewer,
            threadId,
            paged: query.get("paged") === "1",
          });
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Could not load your account.",
            },
            401,
          );
        }
      },
      POST: async ({ request, params }) => {
        if (!sameOrigin(request))
          return json({ error: "Invalid request origin" }, 403);
        const op = params._splat ?? "";
        if (op === "cards-claim") return cardsRequest(true);
        if (op === "profile") {
          const body = await request.text();
          if (body.length > 8192) return json({ error: "Request too large" }, 413);
          let action;
          try {
            action = profileActionSchema.parse(JSON.parse(body));
          } catch {
            return json({ error: "Check the details and try again." }, 400);
          }
          return profileRequest("profile-action", profileActionResultSchema, { action });
        }
        if (op === "wallet") {
          const body = await request.text();
          if (body.length > 4096) return json({ error: "Request too large" }, 413);
          let action;
          try {
            action = linkedWalletActionSchema.parse(JSON.parse(body));
          } catch {
            return json({ error: "Check the details and try again." }, 400);
          }
          return walletRequest("wallet-action", linkedWalletResultSchema, { origin: new URL(request.url).origin, action });
        }
        if (["inference-connect", "inference-disconnect"].includes(op)) {
          let viewer;
          try {
            viewer = await identity();
          } catch {
            return json(
              { error: "Sign in to manage your ChatGPT connection." },
              401,
            );
          }
          try {
            const response = await agentRequest(op, viewer);
            if (!response.ok)
              return json(
                {
                  error:
                    "Could not update your connection. Wait for any reply to finish, then try again.",
                },
                503,
              );
            return json(inferenceStatusSchema.parse(await response.json()));
          } catch {
            return json(
              { error: "Could not update your connection. Try again." },
              503,
            );
          }
        }
        if (!["turn", "basket", "thread-delete"].includes(op))
          return json({ error: "Not found" }, 404);
        try {
          const viewer = await identity();
          const body = await request.text();
          if (body.length > 8192)
            return json({ error: "Request too large" }, 413);
          const input: unknown = JSON.parse(body);
          // A turn that accepts text/event-stream is answered paragraph by paragraph; the agent's streaming body passes through untouched.
          return await agentRequest(
            op,
            op === "turn"
              ? { ...turn.parse(input), ...viewer }
              : op === "thread-delete"
                ? { ...threadDelete.parse(input), ...viewer }
                : { identity: viewer, basket: basketSchema.parse(input) },
            op === "turn" ? request.headers.get("Accept") : undefined,
          );
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Could not process this request.",
            },
            400,
          );
        }
      },
    },
  },
});

async function pnlRequest(request: Request) {
  const params = new URL(request.url).searchParams;
  const days = pnlDaysSchema.safeParse(Number(params.get("days") ?? 30));
  if (!days.success) return json({ error: "Choose 7, 30, 90 or 365 days." }, 400);
  const wallet = ownedWalletSchema.optional().safeParse(params.get("wallet") ?? undefined);
  if (!wallet.success) return json({ error: "Check the wallet address." }, 400);
  let viewer;
  try { viewer = await identity(); }
  catch { return json({ error: "Sign in to see your P&L." }, 401); }
  try {
    const response = await agentRequest("pnl", wallet.data ? { ...viewer, days: days.data, wallet: wallet.data } : { ...viewer, days: days.data });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = z.object({ error: z.string() }).safeParse(body).data?.error;
      if (response.status === 400 && error) return json({ error }, 400);
      return json({ error: response.status === 502 && error ? error : "Could not load your P&L. Try again." }, 503);
    }
    return json(webPnlSchema.parse(body));
  } catch { return json({ error: "Could not load your P&L. Try again." }, 503); }
}

async function profileRequest<Output extends JsonInput>(path: string, schema: z.ZodType<Output>, input?: { safe: string } | { action: JsonInput } | { tokens: string[]; stocks: boolean }) {
  let viewer;
  try { viewer = await identity(); }
  catch { return json({ error: "Sign in to manage your Safes." }, 401); }
  try {
    const response = await agentRequest(path, input === undefined ? viewer : "action" in input ? { identity: viewer, action: input.action } : { ...viewer, ...input });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = z.object({ error: z.string() }).safeParse(body).data?.error;
      return json({ error: response.status === 400 && error ? error : "Pecu couldn't finish this request. Try again." }, response.status === 400 ? 400 : 503);
    }
    return json(schema.parse(body));
  } catch { return json({ error: "Pecu couldn't finish this request. Try again." }, 503); }
}

async function walletRequest<Output extends JsonInput>(path: "wallets" | "wallet-action", schema: z.ZodType<Output>, input?: { origin: string; action: JsonInput }) {
  let viewer;
  try { viewer = await identity(); }
  catch { return json({ error: "Sign in to manage your wallets." }, 401); }
  try {
    const response = await agentRequest(path, input ? { identity: viewer, ...input } : viewer);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = z.object({ error: z.string() }).safeParse(body).data?.error;
      return json({ error: response.status === 400 && error ? error : "Pecu couldn't finish this wallet request. Try again." }, response.status === 400 ? 400 : 503);
    }
    return json(schema.parse(body));
  } catch { return json({ error: "Pecu couldn't finish this wallet request. Try again." }, 503); }
}

async function cardsRequest(claim: boolean) {
  let viewer;
  try { viewer = await cardIdentity(); }
  catch { return json({ error: "Sign in to view your cards." }, 401); }
  try {
    const response = await agentRequest(claim ? "cards-claim" : "cards", viewer);
    if (!response.ok) throw new Error("Cards unavailable");
    return json(cardCollectionSchema.parse(await response.json()));
  } catch { return json({ error: "Could not load your cards. Try again." }, 503); }
}
