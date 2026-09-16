import { UserInference, InferenceTools } from "../../src/cloudflare/user-inference";
export { UserInference };
import { ActivityQueue } from "../../src/cloudflare/activity-queue";
import { createChat } from "@xdevplatform/chat-xdk";
import { normalizeJuiceboxConfig } from "../../src/x/chat";
import { DurableObject } from "cloudflare:workers";
import { DurableStore } from "../../src/cloudflare/durable-store";
import { eventProcessingLeaseMs } from "../../src/state";

type Env = { INFERENCE: DurableObjectNamespace<UserInference>; STORE: DurableObjectNamespace<StoreProbe>; MODEL: DurableObjectNamespace<ModelTransportProbe> };

export class ModelTransportProbe extends DurableObject<Env> {
  override async fetch(): Promise<Response> {
    const { OpenCodeWorkerd } = await import("@opencode-ai/sdk/workerd");
    let requests = 0;
    const options = {
      storage: this.ctx.storage,
      models: { snapshot: true, fetch: false },
      config: { providers: { openai: { settings: { apiKey: "offline-test-key", baseURL: "https://model.invalid/v1" } } }, share: "disabled" as const, snapshots: false, formatter: false as const, lsp: false as const, websearch: false as const, warming: false },
      fetch: Object.assign(async (input: RequestInfo | URL) => {
        if (new URL(input instanceof Request ? input.url : String(input)).hostname === "model.invalid") requests++;
        return Response.json({ error: { message: "native-transport-test", type: "authentication_error" } }, { status: 401 });
      }, { preconnect() {} }),
    };
    const client = await OpenCodeWorkerd.create(options);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await client.generate.text({ model: { providerID: "openai", id: "gpt-5.6-sol" }, prompt: "Reply OK." });
        } catch (error) {
          if (requests !== attempt + 1) throw error;
        }
      }
      return Response.json({ requests });
    } finally {
      await client.close();
    }
  }
}

export class StoreProbe extends DurableObject<Env> {
  override async alarm(): Promise<void> {
    await new ActivityQueue(this.ctx.storage).drain(async () => {
      await new Promise((resolve) => setTimeout(resolve, 31_000));
      await this.ctx.storage.put("queue-completed", true);
    });
  }
  override async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/queue") {
      if (request.method === "POST") {
        await this.ctx.storage.delete("queue-completed");
        await new ActivityQueue(this.ctx.storage).enqueue({ event: "test" });
        return Response.json({ queued: true });
      }
      return Response.json({ completed: Boolean(await this.ctx.storage.get("queue-completed")) });
    }
    const store = new DurableStore(this.ctx.storage);
    store.initialize();
    const eventId = crypto.randomUUID();
    const now = Date.now();
    const first = store.claimEvent(eventId, "conversation", "sender", false, now);
    const duplicate = store.claimEvent(eventId, "conversation", "sender", false, now + 1);
    const reclaimed = store.claimEvent(eventId, "conversation", "sender", false, now + eventProcessingLeaseMs);
    store.completeEvent(eventId, "reply");
    const completed = store.claimEvent(eventId, "conversation", "sender", false, now + eventProcessingLeaseMs + 1);
    store.saveChatDetails("sender", "conversation", '{"amount":"0.000001"}');
    store.setYolo("sender", "conversation", true);
    store.enqueueReply(`reply:${eventId}`, "conversation", "raw-event", "/confirm ABC123");
    const outgoing = store.pendingReplies().find((item) => item.replyToEvent === "raw-event");
    if (outgoing) store.prepareReply(outgoing.id, JSON.stringify({ messageId: "preview-id" }));
    const reloaded = new DurableStore(this.ctx.storage);
    reloaded.initialize();
    const details = reloaded.chatDetails("sender", "conversation");
    const isolated = reloaded.chatDetails("other", "conversation") === undefined && reloaded.chatDetails("sender", "other") === undefined;
    const yoloPersisted = reloaded.yoloEnabled("sender", "conversation");
    const yoloIsolated = !reloaded.yoloEnabled("other", "conversation") && !reloaded.yoloEnabled("sender", "other");
    const outgoingMatched = reloaded.outgoingReplyText("preview-id", "conversation") === "/confirm ABC123" && reloaded.outgoingReplyText("preview-id", "other") === undefined;
    return Response.json({ first, duplicate, reclaimed, completed, details, isolated, yoloPersisted, yoloIsolated, outgoingMatched });
  }
}

const embeddedConfig = JSON.stringify({
  realms: [
    {
      id: "0f".repeat(16),
      address: "https://realm.invalid/",
    },
  ],
  register_threshold: 1,
  recover_threshold: 1,
  pin_hashing_mode: "Standard2019",
});
const xdkJuiceboxConfig = {
  keyStoreTokenMapJson: embeddedConfig,
  maxGuessCount: 20,
  tokenMap: [
    {
      key: "0f".repeat(16),
      value: {
        address: "https://realm.invalid/",
        token: "unused-offline-token",
      },
    },
  ],
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/inference") {
      const first = env.INFERENCE.getByName(`x:111:${crypto.randomUUID()}`);
      const second = env.INFERENCE.getByName(`x:222:${crypto.randomUUID()}`);
      const a = await first.status();
      const b = await second.status();
      const bridge = new InferenceTools({ walletAddress: async () => { throw new Error("Must not call tools without a subscription"); } } as never);
      const reply = await first.respond({ senderId: "111", eventId: "offline-test", conversationId: "test", text: "Hello" } as never, false, bridge);
      return Response.json({ disconnected: !a.connected && !b.connected, separate: first.id.toString() !== second.id.toString(), blocked: reply.includes("Connect your ChatGPT") });
    }
    if (["/store", "/queue"].includes(new URL(request.url).pathname)) return env.STORE.get(env.STORE.idFromName("test")).fetch(request);
    if (new URL(request.url).pathname === "/model") return env.MODEL.getByName(crypto.randomUUID()).fetch(request);
    try {
      const chat = await createChat({
        juiceboxConfig: normalizeJuiceboxConfig(xdkJuiceboxConfig),
        getAuthToken: async () => "unused-offline-token",
      });
      chat.free();
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
