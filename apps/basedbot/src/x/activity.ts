type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type JsonObject = Record<string, unknown>;

export type RealtimeSetup = Readonly<{
  webhookId: string;
  webhookUrl: string;
  subscriptions: readonly string[];
}>;

const chatEvents = ["chat.received"] as const;

function objects(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object");
  if (!value || typeof value !== "object") return [];
  const record = value as JsonObject;
  if (Array.isArray(record.data)) return objects(record.data);
  if (record.data && typeof record.data === "object") {
    const data = record.data as JsonObject;
    if (Array.isArray(data.webhooks)) return objects(data.webhooks);
    if (data.webhook && typeof data.webhook === "object") return [data.webhook as JsonObject];
    if (data.subscription && typeof data.subscription === "object") return [data.subscription as JsonObject];
    return [data];
  }
  return [record];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorDetail(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const payload = value as JsonObject;
  const errors = Array.isArray(payload.errors) ? payload.errors : [];
  const details = [payload, ...errors].flatMap((error) => {
    if (!error || typeof error !== "object") return [];
    return ["detail", "message", "reason", "parameter", "title"].flatMap((key) => {
      const detail = text(Reflect.get(error, key));
      return detail ? [detail] : [];
    });
  });
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
        const filter = item.filter;
        return filter && typeof filter === "object" && "user_id" in filter && filter.user_id === botUserId;
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
          tag: "BasedBot chat.received",
          webhook_id: webhookId,
        }),
      }, "user"));
    const removed = new Set<string>();
    let created: JsonObject[];
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
          body: JSON.stringify({ webhook_id: id, tag: "BasedBot chat.received" }),
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
        const filter = item.filter && typeof item.filter === "object" ? item.filter as JsonObject : {};
        return item.event_type === eventType && filter.user_id === botUserId;
      });
      const subscriptionId = text(existing?.subscription_id);
      if (subscriptionId && existing?.webhook_id !== webhookId) {
        await this.call(`/2/activity/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: "PUT",
          body: JSON.stringify({ webhook_id: webhookId, tag: `BasedBot ${eventType}` }),
        }, "app");
      } else if (!existing) {
        await this.call("/2/activity/subscriptions", {
          method: "POST",
          body: JSON.stringify({
            event_type: eventType,
            filter: { user_id: botUserId },
            tag: `BasedBot ${eventType}`,
            webhook_id: webhookId,
          }),
        }, "user");
      }
    }
    return { webhookId, webhookUrl, subscriptions: chatEvents };
  }

  private async ensureWebhook(webhookUrl: string): Promise<JsonObject> {
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

  private async call(path: string, init: RequestInit = {}, authentication: "app" | "user" = "app"): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${authentication === "app" ? this.bearerToken : this.userAccessToken}`);
    headers.set("Content-Type", "application/json");
    const response = await this.request(`https://api.x.com${path}`, { ...init, headers });
    const raw = await response.text();
    let payload: unknown = {};
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch { payload = { detail: raw.slice(0, 500) }; }
    }
    if (!response.ok) {
      const detail = errorDetail(payload);
      throw new Error(`X Activity API ${init.method ?? "GET"} ${path} failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return payload;
  }
}
