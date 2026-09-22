import { z } from "zod";
import { clerkUserIdSchema, xSenderIdSchema } from "./web-identity";

export const CARD_RECIPIENT_LIMIT = 3000;
export const CARD_COPY_LIMIT = 10;
export const cardIdSchema = z.number().int().min(1).max(30);
export const cardViewerSchema = z.object({
  userId: clerkUserIdSchema,
  xId: xSenderIdSchema.nullable(),
}).strict();
export const cardCollectionSchema = z.object({
  status: z.enum(["owned", "eligible", "connect_x", "sold_out", "x_already_claimed"]),
  created: z.boolean(),
  remaining: z.number().int().min(0).max(CARD_RECIPIENT_LIMIT),
  edition: z.number().int().min(1).max(CARD_RECIPIENT_LIMIT).nullable(),
  cards: z.array(z.object({ id: cardIdSchema, copies: z.number().int().min(1).max(CARD_COPY_LIMIT) })),
});
export type CardViewer = z.infer<typeof cardViewerSchema>;
export type CardCollection = z.infer<typeof cardCollectionSchema>;

export const PECU_CARDS = [
  "Pocket garden", "Moon keeper", "Coral tide", "Cloud courier", "Mushroom cottage",
  "Arcade champion", "Star baker", "Vinyl night", "Treasure diver", "Paper explorer",
  "Cherry picnic", "Rainbow greenhouse", "Cloud nine", "Matcha ritual", "Solar sailor",
  "Frosted fortune", "Bloom guardian", "Lucky arcade", "Museum piece", "Campfire stories",
  "Bubble bath", "Time gardener", "Postage pal", "Cosmic terrarium", "Candy sculptor",
  "Sunflower nap", "Rainy window", "Secret library", "Crystal orchard", "First connection",
].map((name, index) => ({ id: index + 1, name, image: `/assets/pecu-cards/${String(index + 1).padStart(2, "0")}.webp` }));
