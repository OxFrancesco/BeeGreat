import { defineTool } from "@flue/runtime";
import * as v from "valibot";
import { callMindService, type MindServiceOptions } from "./mind-tools";

export function createCrmTools(
  userId: string,
  convexUrl: string,
  options: MindServiceOptions,
) {
  return [
    defineTool({
      name: "list_contacts",
      description:
        "Find personal CRM contacts by name, context, email, phone or notes. Returns at most 30 contacts. Use followups for scheduled follow-ups, archived for contacts to restore. Use the crm beeui component with returned contacts.",
      input: v.object({
        view: v.picklist(["all", "followups", "archived"]),
        search: v.optional(v.string()),
      }),
      async run({ data }) {
        return {
          output: await callMindService(
            userId,
            convexUrl,
            options,
            "list",
            data,
            "crm",
          ),
        };
      },
    }),
    defineTool({
      name: "save_contact",
      description:
        "Create or edit a personal CRM contact at the user request. Find the exact contact first before editing and preserve its existing fields. Omit contactId only to create. Dates are YYYY-MM-DD in the user timezone; null clears a date, empty string clears text. Record lastContactedOn only when the user says contact happened. Saving a follow-up tracks a date in CRM, it does not schedule a notification.",
      input: v.object({
        contactId: v.optional(v.string()),
        name: v.string(),
        context: v.string(),
        email: v.string(),
        phone: v.string(),
        note: v.string(),
        followUpOn: v.nullable(v.string()),
        lastContactedOn: v.nullable(v.string()),
      }),
      async run({ data }) {
        return {
          output: await callMindService(
            userId,
            convexUrl,
            options,
            "save",
            data,
            "crm",
          ),
        };
      },
    }),
    defineTool({
      name: "archive_contact",
      description:
        "Archive or restore an exact CRM contact when requested by the user. Find the contact first. archived=false restores it.",
      input: v.object({ contactId: v.string(), archived: v.boolean() }),
      async run({ data }) {
        return {
          output: await callMindService(
            userId,
            convexUrl,
            options,
            "archive",
            data,
            "crm",
          ),
        };
      },
    }),
  ];
}
