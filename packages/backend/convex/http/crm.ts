import * as Schema from "effect/Schema";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import {
  AgentUserId,
  decodeRequestBody,
  jsonResponse,
  readJsonBody,
  requestDocumentId,
  requireBrokerSecret,
  requireJsonContentType,
  type JsonValue,
} from "./middleware";

const List = Schema.Struct({
  userId: AgentUserId,
  operation: Schema.Literal("list"),
  view: Schema.Literals(["all", "followups", "archived"]),
  search: Schema.optional(Schema.String),
});
const Save = Schema.Struct({
  userId: AgentUserId,
  operation: Schema.Literal("save"),
  contactId: Schema.optional(Schema.String),
  name: Schema.String,
  context: Schema.String,
  email: Schema.String,
  phone: Schema.String,
  note: Schema.String,
  followUpOn: Schema.NullOr(Schema.String),
  lastContactedOn: Schema.NullOr(Schema.String),
});
const Archive = Schema.Struct({
  userId: AgentUserId,
  operation: Schema.Literal("archive"),
  contactId: Schema.String,
  archived: Schema.Boolean,
});

export const crm = httpAction(async (ctx, request) => {
  const error = requireBrokerSecret(request) ?? requireJsonContentType(request);
  if (error) return error;
  const raw = await readJsonBody<JsonValue>(request);
  try {
    const list = decodeRequestBody(List, raw);
    if (list) {
      const { operation: _, ...args } = list;
      return jsonResponse(
        await ctx.runQuery(internal.agentCrm.list, args),
        200,
      );
    }
    const save = decodeRequestBody(Save, raw);
    if (save) {
      const { operation: _, contactId, ...args } = save;
      return jsonResponse(
        await ctx.runMutation(internal.agentCrm.save, {
          ...args,
          contactId: contactId
            ? requestDocumentId<"crmContacts">(contactId)
            : undefined,
        }),
        200,
      );
    }
    const archive = decodeRequestBody(Archive, raw);
    if (archive) {
      return jsonResponse(
        await ctx.runMutation(internal.agentCrm.archive, {
          userId: archive.userId,
          contactId: requestDocumentId<"crmContacts">(archive.contactId),
          archived: archive.archived,
        }),
        200,
      );
    }
    return jsonResponse({ error: "Invalid CRM request" }, 400);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "CRM request failed" },
      400,
    );
  }
});
