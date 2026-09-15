import { describe, expect, test } from "bun:test";
import { XActivityAdmin } from "../src/x/activity";

describe("X Activity realtime setup", () => {
  test("creates one webhook and the supported encrypted-chat subscription", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const admin = new XActivityAdmin("app-bearer", "user-token", async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, ...(typeof init?.body === "string" ? { body: init.body } : {}) });
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        url.includes("/activity/subscriptions") && method === "POST" ? "Bearer user-token" : "Bearer app-bearer",
      );
      if (new URL(url).pathname === "/2/webhooks" && method === "GET") return Response.json({ data: [] });
      if (new URL(url).pathname === "/2/webhooks" && method === "POST") {
        return Response.json({ data: { id: "webhook-1", url: "https://bot.example/x/webhook", valid: true } });
      }
      if (url.endsWith("/2/activity/subscriptions") && method === "GET") return Response.json({ data: [] });
      return Response.json({ data: {} });
    });

    const result = await admin.ensureRealtime("https://bot.example/x/webhook", "bot-user");
    expect(result.webhookId).toBe("webhook-1");
    expect(calls[0]?.url).toContain("webhook_config.fields=url,valid");
    const subscriptionBodies = calls
      .filter((call) => call.url.endsWith("/2/activity/subscriptions") && call.method === "POST")
      .map((call) => JSON.parse(call.body ?? "{}"));
    expect(subscriptionBodies).toEqual([
      {
        event_type: "chat.received",
        filter: { user_id: "bot-user" },
        tag: "Pecu chat.received",
        webhook_id: "webhook-1",
      },
    ]);
  });

  test("reuses existing resources and repairs webhook delivery", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const admin = new XActivityAdmin("app-bearer", "user-token", async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (new URL(url).pathname === "/2/webhooks") {
        return Response.json({ data: [{ id: "webhook-1", url: "https://bot.example/x/webhook", valid: true }] });
      }
      if (url.endsWith("/2/activity/subscriptions")) {
        return Response.json({ data: [
          { subscription_id: "sub-1", event_type: "chat.received", filter: { user_id: "bot-user" } },
        ] });
      }
      return Response.json({ data: {} });
    });

    await admin.ensureRealtime("https://bot.example/x/webhook", "bot-user");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
    expect(calls).toContainEqual({
      url: "https://api.x.com/2/activity/subscriptions/sub-1",
      method: "PUT",
    });
  });

  test("revalidates only this bot's webhook and subscription", async () => {
    const writes: string[] = [];
    const admin = new XActivityAdmin("app-bearer", "user-token", async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "PUT") {
        writes.push(url.pathname);
        return Response.json({ data: {} });
      }
      if (url.pathname === "/2/webhooks") {
        return Response.json({ data: [
          { id: "own", url: "https://bot.example/x/webhook", valid: true },
          { id: "other", url: "https://other.example/x/webhook", valid: true },
        ] });
      }
      return Response.json({ data: [
        { subscription_id: "own-sub", webhook_id: "own", filter: { user_id: "bot-user" } },
        { subscription_id: "other-sub", webhook_id: "other", filter: { user_id: "other-user" } },
      ] });
    });
    await admin.revalidateRealtime("https://bot.example/x/webhook", "bot-user");
    expect(writes).toEqual(["/2/webhooks/own", "/2/activity/subscriptions/own-sub"]);
  });


  test.each([201, 503])("replacement preserves existing delivery until X confirms creation, HTTP %s", async (status) => {
    const writes: string[] = [];
    const admin = new XActivityAdmin("app-bearer", "user-token", async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? "GET";
      if (method !== "GET") writes.push(`${method} ${path}`);
      if (method === "POST") {
        return Response.json(status === 201
          ? { data: { subscription_id: "new-sub" } }
          : { detail: "Service Unavailable" }, { status });
      }
      if (path === "/2/webhooks") {
        return Response.json({ data: [{ id: "own", url: "https://bot.example/x/webhook", valid: true }] });
      }
      return Response.json({ data: [
        { subscription_id: "old-sub", webhook_id: "own", event_type: "chat.received", filter: { user_id: "bot-user" } },
        { subscription_id: "other-sub", webhook_id: "own", event_type: "chat.received", filter: { user_id: "other-user" } },
      ] });
    });
    const replacement = admin.replaceRealtimeSubscription("https://bot.example/x/webhook", "bot-user");
    if (status === 201) {
      await replacement;
      expect(writes).toEqual(["POST /2/activity/subscriptions", "DELETE /2/activity/subscriptions/old-sub"]);
    } else {
      await expect(replacement).rejects.toThrow("503");
      expect(writes).toEqual(["POST /2/activity/subscriptions"]);
    }
  });

});

test("duplicate subscription repair recreates only the matching bot subscription", async () => {
  const writes: string[] = [];
  let deleted = false;
  let created = false;
  const admin = new XActivityAdmin("app", "user", async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const method = init?.method ?? "GET";
    expect(new Headers(init?.headers).get("Authorization")).toBe(method === "POST" ? "Bearer user" : "Bearer app");
    if (method !== "GET") writes.push(`${method} ${path}${url.search}`);
    if (method === "POST") {
      if (!deleted) return Response.json({
        detail: "One or more parameters to your request was invalid.",
        errors: [{ message: "DuplicateSubscription: A subscription already exists for event type 'chat.received' with the same filters" }],
      }, { status: 400 });
      created = true;
      return Response.json({ data: { subscription: { subscription_id: "new" } } });
    }
    if (method === "DELETE") {
      if (path.endsWith("/old")) return Response.json({ detail: "Service Unavailable" }, { status: 503 });
      expect(path).toBe("/2/activity/subscriptions");
      expect(url.searchParams.get("ids")).toBe("old");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer app");
      deleted = true;
      return Response.json({ data: [{ deleted: true, subscription_id: "old" }] });
    }
    if (path === "/2/webhooks") return Response.json({ data: [{ id: "hook", url: "https://bot.example/x/webhook", valid: true }] });
    return Response.json({ data: [
      { subscription_id: created ? "new" : "old", webhook_id: "hook", event_type: "chat.received", filter: { user_id: "bot" } },
      { subscription_id: "other", webhook_id: "hook", event_type: "chat.received", filter: { user_id: "other-user" } },
    ] });
  });
  const result = await admin.replaceRealtimeSubscription("https://bot.example/x/webhook", "bot");
  expect(result.subscriptions).toHaveLength(1);
  expect(result.subscriptions[0]?.subscription_id).toBe("new");
  expect(writes).toEqual(["POST /2/activity/subscriptions", "DELETE /2/activity/subscriptions/old", "DELETE /2/activity/subscriptions?ids=old", "POST /2/activity/subscriptions"]);
});
