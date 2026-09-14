import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  query,
  mutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { contactFields, contactValidator, contactView } from "./crmValidators";

type ContactInput = Pick<Doc<"crmContacts">, keyof typeof contactFields>;

async function owner(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Sign in to use CRM");
  return identity.tokenIdentifier;
}

export async function ownedContact(
  ctx: QueryCtx | MutationCtx,
  ownerKey: string,
  contactId: Id<"crmContacts">,
) {
  const contact = await ctx.db.get("crmContacts", contactId);
  if (!contact || contact.ownerKey !== ownerKey)
    throw new ConvexError("Contact not found");
  return contact;
}

function date(value: string | null) {
  if (value === null) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw new ConvexError("Use a valid date in YYYY-MM-DD format");
  }
  return value;
}

function normalize(input: ContactInput) {
  const name = input.name.trim();
  if (!name || name.length > 160)
    throw new ConvexError("Enter a name of up to 160 characters");
  for (const field of ["context", "email", "phone", "note"] as const) {
    if (input[field].length > (field === "note" ? 4000 : 240))
      throw new ConvexError(`${field} is too long`);
  }
  const result = {
    name,
    context: input.context.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    note: input.note.trim(),
    followUpOn: date(input.followUpOn),
    lastContactedOn: date(input.lastContactedOn),
  };
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new ConvexError("Enter a valid email address");
  return {
    ...result,
    hasFollowUp: result.followUpOn !== null,
    searchText: [
      name,
      result.context,
      result.email,
      result.phone,
      result.note,
    ].join(" "),
    updatedAt: Date.now(),
  };
}

export function contactQuery(
  ctx: QueryCtx,
  ownerKey: string,
  view: "all" | "followups" | "archived",
  search?: string,
) {
  const text = search?.trim().slice(0, 240);
  if (text)
    return ctx.db
      .query("crmContacts")
      .withSearchIndex("search_contacts", (q) => {
        const scoped = q
          .search("searchText", text)
          .eq("ownerKey", ownerKey)
          .eq("archived", view === "archived");
        return view === "followups" ? scoped.eq("hasFollowUp", true) : scoped;
      });
  if (view === "followups")
    return ctx.db
      .query("crmContacts")
      .withIndex("by_owner_archived_followup", (q) =>
        q.eq("ownerKey", ownerKey).eq("archived", false).gt("followUpOn", null),
      );
  return ctx.db
    .query("crmContacts")
    .withIndex("by_owner_archived_name", (q) =>
      q.eq("ownerKey", ownerKey).eq("archived", view === "archived"),
    );
}

export async function saveContact(
  ctx: MutationCtx,
  ownerKey: string,
  input: ContactInput,
  contactId?: Id<"crmContacts">,
) {
  if (contactId) {
    await ownedContact(ctx, ownerKey, contactId);
    await ctx.db.patch("crmContacts", contactId, normalize(input));
    return contactId;
  }
  return await ctx.db.insert("crmContacts", {
    ownerKey,
    ...normalize(input),
    archived: false,
  });
}

export const list = query({
  args: {
    view: contactView,
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(contactValidator),
  handler: async (ctx, args) =>
    contactQuery(ctx, await owner(ctx), args.view, args.search).paginate(
      args.paginationOpts,
    ),
});

export const get = query({
  args: { contactId: v.string() },
  returns: v.union(contactValidator, v.null()),
  handler: async (ctx, { contactId }) => {
    const ownerKey = await owner(ctx);
    const normalized = ctx.db.normalizeId("crmContacts", contactId);
    if (!normalized) return null;
    const contact = await ctx.db.get("crmContacts", normalized);
    return contact?.ownerKey === ownerKey ? contact : null;
  },
});

export const save = mutation({
  args: { contactId: v.optional(v.id("crmContacts")), ...contactFields },
  returns: v.id("crmContacts"),
  handler: async (ctx, { contactId, ...input }) =>
    saveContact(ctx, await owner(ctx), input, contactId),
});

export const archive = mutation({
  args: { contactId: v.id("crmContacts"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { contactId, archived }) => {
    await ownedContact(ctx, await owner(ctx), contactId);
    await ctx.db.patch("crmContacts", contactId, {
      archived,
      updatedAt: Date.now(),
    });
    return null;
  },
});
