import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { agentRequest, identity, sameOrigin } from "../lib/server";
import { basketSchema, threadIdSchema } from "../../../../src/web-contract";
const turn = z
  .object({
    requestId: z.string().uuid(),
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
        if (params._splat !== "state") return json({ error: "Not found" }, 404);
        try {
          const thread = new URL(request.url).searchParams.get("t");
          const threadId = thread ? threadIdSchema.parse(thread) : undefined;
          return await agentRequest("state", { ...(await identity()), threadId });
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
        if (!["turn", "basket", "thread-delete"].includes(op))
          return json({ error: "Not found" }, 404);
        try {
          const viewer = await identity();
          const body = await request.text();
          if (body.length > 8192)
            return json({ error: "Request too large" }, 413);
          const input: unknown = JSON.parse(body);
          return await agentRequest(
            op,
            op === "turn"
              ? { ...turn.parse(input), ...viewer }
              : op === "thread-delete"
                ? { ...threadDelete.parse(input), ...viewer }
                : { identity: viewer, basket: basketSchema.parse(input) },
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
