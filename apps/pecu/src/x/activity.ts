import { z } from "zod";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const textSchema = z.string().min(1).optional().catch(undefined);
const itemSchema = z.object({
  id: textSchema, url: textSchema, subscription_id: textSchema,
  event_type: textSchema, webhook_id: textSchema,
  valid: z.boolean().optional().catch(undefined),
  deleted: z.boolean().optional().catch(undefined),
  filter: z.object({ user_id: textSchema }).optional().catch(undefined),
}).catchall(z.json());
const itemsSchema = z.array(itemSchema.catch({}));
const nestedSchema = itemSchema.extend({
  webhooks: itemsSchema.optional().catch(undefined),
  webhook: itemSchema.optional().catch(undefined),
  subscription: itemSchema.optional().catch(undefined),
});
const responseSchema = z.union([itemsSchema, itemSchema.extend({ data: z.union([itemsSchema, nestedSchema]).optional().catch(undefined) })]);
const payloadSchema = z.json();
type ActivityPayload = z.infer<typeof payloadSchema>;
type ActivityItem = z.infer<typeof itemSchema>;

export type RealtimeSetup = Readonly<{
  webhookId: string;
  webhookUrl: string;
  subscriptions: readonly string[];
}>;

const chatEvents = ["chat.received"] as const;

function objects(value: ActivityPayload): ActivityItem[] {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) return [];
  const response = parsed.data;
  if (Array.isArray(response)) return response;
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (!data) return [response];
  return data.webhooks ?? [data.webhook ?? data.subscription ?? data];
}

const text = textSchema.parse;

const errorFields = z.object({ detail: textSchema, message: textSchema, reason: textSchema, parameter: textSchema, title: textSchema });
const errorSchema = errorFields.extend({ errors: z.array(errorFields.catch({})).catch([]) });

function errorDetail(value: ActivityPayload): string | undefined {
  const parsed = errorSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const payload = parsed.data;
  const details = [payload, ...payload.errors].flatMap((error) =>
    [error.detail, error.message, error.reason, error.parameter, error.title].filter((detail) => detail !== undefined));
  return [...new Set(details)].join("; ").slice(0, 1_500) || undefined;
}

export class XActivityAdmin {
  private readonly request: Fetcher;

  constructor(
    private readonly bearerToken: string,
    private readonly userAccessToken: string,
    request?: Fetcher,
  ) {
    this.request = request ?? ((input, init) => fetch(input, init));
  }

  async inspectRealtime(webhookUrl: string, botUserId: string) {
    const webhooks = objects(await this.call("/2/webhooks?webhook_config.fields=url,valid"))
      .filter((item) => item.url === webhookUrl);
    const subscriptions = objects(await this.call("/2/activity/subscriptions", {}, "app"))
      .filter((item) => {
        return item.filter?.user_id === botUserId;
      });
    return { webhooks, subscriptions };
  }

  async replaceRealtimeSubscription(webhookUrl: string, botUserId: string) {
    const before = await this.inspectRealtime(webhookUrl, botUserId);
    const webhookId = text(before.webhooks.find((webhook) => webhook.valid === true)?.id);
    if (!webhookId) throw new Error("A validated X webhook is required before replacing its subscription");
    const existingIds = before.subscriptions.flatMap((subscription) => {
      const id = text(subscription.subscription_id);
      return id && subscription.event_type === "chat.received" && subscription.webhook_id === webhookId ? [id] : [];
    });
    const create = async () => objects(await this.call("/2/activity/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          event_type: "chat.received",
          filter: { user_id: botUserId },
          tag: "Pecu chat.received",
          webhook_id: webhookId,
        }),
      }, "user"));
    const removed = new Set<string>();
    let created: ActivityItem[];
    try {
      created = await create();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("DuplicateSubscription") || existingIds.length === 0) throw error;
      for (const id of existingIds) {
        await this.deleteSubscription(id);
        removed.add(id);
      }
      created = await create();
    }
    const replacementId = text(created[0]?.subscription_id);
    if (!replacementId) throw new Error("X did not confirm a replacement subscription");
    for (const subscription of before.subscriptions) {
      const id = text(subscription.subscription_id);
      if (id && !removed.has(id) && id !== replacementId && subscription.event_type === "chat.received" && subscription.webhook_id === webhookId) {
        await this.deleteSubscription(id);
      }
    }
    return this.inspectRealtime(webhookUrl, botUserId);
  }

  private async deleteSubscription(id: string): Promise<void> {
    try {
      await this.call(`/2/activity/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" }, "app");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("HTTP 503")) throw error;
      const result = await this.call(`/2/activity/subscriptions?ids=${encodeURIComponent(id)}`, { method: "DELETE" }, "app");
      if (!objects(result).some((entry) => entry.subscription_id === id && entry.deleted === true)) {
        throw new Error(`X did not delete subscription ${id}: ${errorDetail(result) ?? "deletion was not confirmed"}`);
      }
    }
  }

  async revalidateRealtime(webhookUrl: string, botUserId: string) {
    const state = await this.inspectRealtime(webhookUrl, botUserId);
    for (const webhook of state.webhooks) {
      const id = text(webhook.id);
      if (!id) continue;
      await this.call(`/2/webhooks/${encodeURIComponent(id)}`, { method: "PUT" });
      for (const subscription of state.subscriptions) {
        const subscriptionId = text(subscription.subscription_id);
        if (!subscriptionId || subscription.webhook_id !== id) continue;
        await this.call(`/2/activity/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: "PUT",
          body: JSON.stringify({ webhook_id: id, tag: "Pecu chat.received" }),
        }, "app");
      }
    }
    return this.inspectRealtime(webhookUrl, botUserId);
  }

  async ensureRealtime(webhookUrl: string, botUserId: string): Promise<RealtimeSetup> {
    const webhook = await this.ensureWebhook(webhookUrl);
    const webhookId = text(webhook.id);
    if (!webhookId) throw new Error("X webhook setup returned no webhook ID");

    const subscriptions = objects(await this.call("/2/activity/subscriptions", {}, "app"));
    for (const eventType of chatEvents) {
      const existing = subscriptions.find((item) => {
        return item.event_type === eventType && item.filter?.user_id === botUserId;
      });
      const subscriptionId = text(existing?.subscription_id);
      if (subscriptionId && existing?.webhook_id !== webhookId) {
        await this.call(`/2/activity/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: "PUT",
          body: JSON.stringify({ webhook_id: webhookId, tag: `Pecu ${eventType}` }),
        }, "app");
      } else if (!existing) {
        await this.call("/2/activity/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            event_type: eventType,
            filter: { user_id: botUserId },
            tag: `Pecu ${eventType}`,
            webhook_id: webhookId,
          }),
        }, "user");
      }
    }
    return { webhookId, webhookUrl, subscriptions: chatEvents };
  }

  private async ensureWebhook(webhookUrl: string): Promise<ActivityItem> {
    const existing = objects(await this.call("/2/webhooks?webhook_config.fields=url,valid"))
      .find((item) => item.url === webhookUrl);
    if (existing) {
      if (existing.valid !== true && text(existing.id)) {
        await this.call(`/2/webhooks/${encodeURIComponent(String(existing.id))}`, { method: "PUT" });
      }
      return existing;
    }
    const created = objects(await this.call("/2/webhooks", {
      method: "POST",
      body: JSON.stringify({ url: webhookUrl }),
    }))[0];
    if (!created) throw new Error("X webhook setup returned an empty response");
    return created;
  }

  private async call(path: string, init: RequestInit = {}, authentication: "app" | "user" = "app"): Promise<ActivityPayload> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${authentication === "app" ? this.bearerToken : this.userAccessToken}`);
    headers.set("Content-Type", "application/json");
    const response = await this.request(`https://api.x.com${path}`, { ...init, headers });
    const raw = await response.text();
    let payload: ActivityPayload = {};
    if (raw) {
      try { payload = payloadSchema.parse(JSON.parse(raw)); }
      catch { payload = { detail: raw.slice(0, 500) }; }
    }
    if (!response.ok) {
      const detail = errorDetail(payload);
      throw new Error(`X Activity API ${init.method ?? "GET"} ${path} failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return payload;
  }
}
