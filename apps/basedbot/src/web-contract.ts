import { z } from "zod";
export const webIdentitySchema = z
  .object({
    userId: z.string().regex(/^user_[A-Za-z0-9]+$/),
    senderId: z.string().regex(/^\d{1,30}$/),
  })
  .strict();
export const webTurnSchema = webIdentitySchema
  .extend({
    requestId: z.string().uuid(),
    text: z.string().trim().min(1).max(4000),
  })
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
  text: z.string(),
  preview: previewSchema.nullable(),
});
export const webMessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.number(),
  reply: webReplySchema.nullable(),
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
  messages: z.array(webMessageSchema),
  stocks: z.string().nullable(),
  stocksAt: z.number().nullable(),
  basket: basketSchema.nullable(),
});
export type WebState = z.infer<typeof webStateSchema>;
