import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { contactQuery, ownedContact, saveContact } from "./crm";
import { contactFields, contactValidator, contactView } from "./crmValidators";

async function owner(ctx: QueryCtx | MutationCtx, userId: string) {
  const hive = await ctx.db
    .query("hives")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .unique();
  if (!hive) throw new Error("Finish Hive setup before using CRM with Bee");
  return hive.ownerKey;
}

export const list = internalQuery({
  args: {
    userId: v.string(),
    view: contactView,
    search: v.optional(v.string()),
  },
  returns: v.array(contactValidator),
  handler: async (ctx, args) =>
    contactQuery(
      ctx,
      await owner(ctx, args.userId),
      args.view,
      args.search,
    ).take(30),
});

export const save = internalMutation({
  args: {
    userId: v.string(),
    contactId: v.optional(v.id("crmContacts")),
    ...contactFields,
  },
  returns: v.id("crmContacts"),
  handler: async (ctx, { userId, contactId, ...input }) =>
    saveContact(ctx, await owner(ctx, userId), input, contactId),
});

export const archive = internalMutation({
  args: {
    userId: v.string(),
    contactId: v.id("crmContacts"),
    archived: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { userId, contactId, archived }) => {
    await ownedContact(ctx, await owner(ctx, userId), contactId);
    await ctx.db.patch("crmContacts", contactId, {
      archived,
      updatedAt: Date.now(),
    });
    return null;
  },
});
