import { z } from "zod";
import { agentQuestionSchema } from "./question-contract";
export const webIdentitySchema = z
  .object({
    userId: z.string().regex(/^user_[A-Za-z0-9]+$/),
    senderId: z.string().regex(/^\d{1,30}$/),
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
  code: z.string().regex(/^[A-F0-9]{6}$/),
  text: z.string(),
  state: z.enum([
    "pending",
    "executing",
    "succeeded",
    "failed",
    "cancelled",
    "expired",
  ]),
  expiresAt: z.number(),
});
export const webReplySchema = z.object({
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
export const webStateSchema = z.object({
  wallet: z.string().nullable(),
  yolo: z.boolean(),
  /** Optional so a client can read state from a backend deployed before threads existed. */
  threadId: z.string().nullable().optional(),
  threads: z.array(webThreadSchema).optional(),
  messages: z.array(webMessageSchema),
  stocks: z.string().nullable(),
  stocksAt: z.number().nullable(),
  basket: basketSchema.nullable(),
});
export type WebState = z.infer<typeof webStateSchema>;
export type WebThread = z.infer<typeof webThreadSchema>;
