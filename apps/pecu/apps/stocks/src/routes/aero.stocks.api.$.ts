import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { agentRequest, cardIdentity, identity, sameOrigin } from "../lib/server";
import { cardCollectionSchema } from "../../../../src/cards-contract";
import {
  basketSchema,
  threadIdSchema,
  messagePageQuerySchema,
  threadPageQuerySchema,
  inferenceStatusSchema,
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
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const Route = createFileRoute("/aero/stocks/api/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (params._splat === "cards") return cardsRequest(false);
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
            ...(query.has("before")
              ? { before: JSON.parse(query.get("before")!) }
              : {}),
            ...(query.has("after")
              ? { after: JSON.parse(query.get("after")!) }
              : {}),
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
