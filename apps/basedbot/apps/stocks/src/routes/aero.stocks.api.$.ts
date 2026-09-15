import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { agentRequest, identity, sameOrigin } from "../lib/server";
import { basketSchema } from "../../../../src/web-contract";
const turn = z
  .object({
    requestId: z.string().uuid(),
    text: z.string().trim().min(1).max(4000),
  })
  .strict();
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
      GET: async ({ params }) => {
        if (params._splat !== "state") return json({ error: "Not found" }, 404);
        try {
          return await agentRequest("state", await identity());
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
        if (!["turn", "basket"].includes(params._splat ?? ""))
          return json({ error: "Not found" }, 404);
        try {
          const viewer = await identity();
          const body = await request.text();
          if (body.length > 8192)
            return json({ error: "Request too large" }, 413);
          const input: unknown = JSON.parse(body);
          return await agentRequest(
            params._splat ?? "",
            params._splat === "turn"
              ? { ...turn.parse(input), ...viewer }
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
