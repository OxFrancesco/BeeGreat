import { stockSnapshotSchema } from "./stock-contract";
import { analyticsResultsSchema } from "./analytics-contract";
import { z } from "zod";
import { agentQuestionSchema } from "./question-contract";
import { clerkUserIdSchema, senderIdSchema } from "./web-identity";
export const inferenceStatusSchema = z.object({
  model: z.string(),
  reasoning: z.string(),
  connected: z.boolean(),
  checkedAt: z.number(),
  lastResponse: z.object({ ok: z.boolean(), at: z.number() }).nullable(),
  /** Optional so a client can read status from a backend deployed before usage limits were tracked. */
  usageLimit: z
    .object({ kind: z.enum(["usage_limit_reached", "usage_not_included"]), resetsAt: z.number().nullable() })
    .nullable()
    .optional(),
  /** Optional so a client can read status from a backend deployed before the shared fallback existed. */
  fallback: z.object({ configured: z.boolean(), active: z.boolean() }).optional(),
  loginState: z.enum(["pending", "complete", "failed", "expired"]).nullable(),
  login: z
    .object({
      url: z
        .string()
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            ["auth.openai.com", "chatgpt.com"].includes(url.hostname)
          );
        }),
      instructions: z.string(),
      userCode: z.string().regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/).optional(),
      expiresAt: z.union([
        z.number(),
        z.enum(["-Infinity", "Infinity", "NaN"]),
      ]),
    })
    .nullable(),
});
export type InferenceStatus = z.infer<typeof inferenceStatusSchema>;
export const webIdentitySchema = z
  .object({
    userId: clerkUserIdSchema,
    senderId: senderIdSchema,
  })
  .strict();
/** Client-chosen thread id. Omitted means the original single web conversation. */
export const threadIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
export const webScopeSchema = webIdentitySchema
  .extend({ threadId: threadIdSchema.optional() })
  .strict();
export const webTurnSchema = webScopeSchema
  .extend({
    requestId: z.string().uuid(),
    retryOf: z.string().min(1).max(300).optional(),
    answerTo: z.string().min(1).max(300).optional(),
    text: z.string().trim().min(1).max(4000),
  })
  .strict();
export const webThreadDeleteSchema = webIdentitySchema
  .extend({ threadId: threadIdSchema.nullable() })
  .strict();
export const previewSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
  title: z.string().optional(),
  text: z.string(),
  state: z.enum([
    "pending",
    "executing",
    "succeeded",
    "failed",
    "cancelled",
    "expired",
  ]),
  result: z.string().optional(),
  expiresAt: z.number(),
});

export function confirmationCommand(text: string): { kind: "confirm" | "cancel"; code: string } | undefined {
  const match = /^\/(confirm|cancel)\s+([A-Za-z0-9]{6})$/i.exec(text.trim());
  if (!match?.[1] || !match[2]) return undefined;
  return { kind: match[1].toLowerCase() as "confirm" | "cancel", code: match[2].toUpperCase() };
}
export const webReplySchema = z.object({
  analytics: analyticsResultsSchema.optional(),
  analyticsOnly: z.boolean().optional(),
  recovery: z.literal("connect_chatgpt").optional(),
  holdings: stockSnapshotSchema.optional(),
  holdingsOnly: z.boolean().optional(),
  question: agentQuestionSchema.optional(),
  text: z.string(),
  preview: previewSchema.nullable(),
});
export const webMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number(),
  canRetry: z.boolean().optional(),
  reply: webReplySchema.nullable(),
});
export const webThreadSchema = z.object({
  id: z.string().nullable(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  count: z.number(),
});
export const basketSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    allocations: z.string().min(1).max(300),
  })
  .strict();
export const messageCursorSchema = z
  .object({
    at: z.number().int().nonnegative(),
    row: z.number().int().positive(),
  })
  .strict();
export const threadCursorSchema = z
  .object({ at: z.number().int().nonnegative(), id: threadIdSchema.nullable() })
  .strict();
export const webStateSchema = z.object({
  wallet: z.string().nullable(),
  /** Optional so a client can read state from a backend deployed before web-only senders existed. */
  senderKind: z.enum(["x", "web"]).optional(),
  yolo: z.boolean(),
  /** Optional so a client can read state from a backend deployed before threads existed. */
  threadId: z.string().nullable().optional(),
  threads: z.array(webThreadSchema).optional(),
  thread: webThreadSchema.nullable().optional(),
  olderCursor: messageCursorSchema.nullable().optional(),
  newerCursor: messageCursorSchema.nullable().optional(),
  messages: z.array(webMessageSchema),
  stocks: z.string().nullable(),
  stocksAt: z.number().nullable(),
  basket: basketSchema.nullable(),
});
export type WebState = z.infer<typeof webStateSchema>;
export type WebThread = z.infer<typeof webThreadSchema>;

export const messagePageQuerySchema = z
  .object({
    before: messageCursorSchema.optional(),
    after: messageCursorSchema.optional(),
  })
  .strict()
  .refine(
    (value) => !(value.before && value.after),
    "Choose one page direction",
  );
export const threadPageQuerySchema = z
  .object({
    before: threadCursorSchema.optional(),
    after: threadCursorSchema.optional(),
  })
  .strict()
  .refine(
    (value) => !(value.before && value.after),
    "Choose one page direction",
  );
export const webHistoryRequestSchema = webScopeSchema
  .extend({ page: messagePageQuerySchema.optional() })
  .strict();
export const webThreadsRequestSchema = webIdentitySchema
  .extend({ page: threadPageQuerySchema.optional() })
  .strict();
export const webStateRequestSchema = webScopeSchema
  .extend({ paged: z.boolean().optional() })
  .strict();
export const messagePageSchema = z.object({
  messages: z.array(webMessageSchema),
  olderCursor: messageCursorSchema.nullable(),
  newerCursor: messageCursorSchema.nullable(),
});
export const threadPageSchema = z.object({
  threads: z.array(webThreadSchema),
  olderCursor: threadCursorSchema.nullable(),
  newerCursor: threadCursorSchema.nullable(),
});
export type MessageCursor = z.infer<typeof messageCursorSchema>;
export type ThreadCursor = z.infer<typeof threadCursorSchema>;
export type MessagePageQuery = z.infer<typeof messagePageQuerySchema>;
export type ThreadPageQuery = z.infer<typeof threadPageQuerySchema>;
export type MessagePage = z.infer<typeof messagePageSchema>;
export type ThreadPage = z.infer<typeof threadPageSchema>;
