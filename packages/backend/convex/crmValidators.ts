import { v } from "convex/values";

export const contactFields = {
  name: v.string(),
  context: v.string(),
  email: v.string(),
  phone: v.string(),
  note: v.string(),
  followUpOn: v.union(v.string(), v.null()),
  lastContactedOn: v.union(v.string(), v.null()),
};

export const contactValidator = v.object({
  _id: v.id("crmContacts"),
  _creationTime: v.number(),
  ownerKey: v.string(),
  ...contactFields,
  archived: v.boolean(),
  hasFollowUp: v.boolean(),
  searchText: v.string(),
  updatedAt: v.number(),
});

export const contactView = v.union(
  v.literal("all"),
  v.literal("followups"),
  v.literal("archived"),
);
