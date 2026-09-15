import { ApiError } from "@xdevplatform/xdk";
import type { ChatWithJuicebox, DecryptedMessage, Event, SendPayload, SigningKeyEntry } from "@xdevplatform/chat-xdk";
import type { BasedBotAgent } from "../agent";
import type { Config } from "../config";
import { log } from "../logger";
import type { TransportStateStore } from "../state";
import { signingKeys } from "./chat";
import type { XApi } from "./api";
import { activityConversation } from "./webhook";
import { nextXApiPollDelayMs } from "./rate-limit";
import { replyConfirmationCode } from "./reply-confirmation";

function comparableConversation(value: string): string {
  return value.replaceAll(":", "-");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const bootstrapLookbackMs = 48 * 60 * 60 * 1_000;
const transportBootstrapVersion = "latest-inbound-v2";

function latestRecentInboundMessageId(
  messages: readonly DecryptedMessage[],
  botUserId: string,
  now = Date.now(),
): string | undefined {
  let latest: { id: string; createdAtMsec: number } | undefined;
  for (const { event } of messages) {
    const id = event.id;
    const senderId = event.senderId;
    const createdAtMsec = event.createdAtMsec ?? now;
    if (
      !id ||
      !senderId ||
      senderId === botUserId ||
      event.type !== "message" ||
      event.verified !== true ||
      !event.content?.text ||
      createdAtMsec < now - bootstrapLookbackMs
    ) continue;
    if (!latest || createdAtMsec > latest.createdAtMsec) latest = { id, createdAtMsec };
  }
  return latest?.id;
}

export type ConversationDiscovery = Readonly<{ ids: readonly string[]; refreshAt: number }>;
export type ConversationDiscoveryStore = {
  get(): Promise<ConversationDiscovery | undefined>;
  put(value: ConversationDiscovery): Promise<void>;
};

export class XChatTransport {
  private readonly knownKeys = new Map<string, SigningKeyEntry[]>();
  private readonly resolvedPeerConversations = new Map<string, string>();
  private discovery: ConversationDiscovery | undefined;

  constructor(
    private readonly api: XApi,
    private readonly chat: ChatWithJuicebox,
    private readonly botUserId: string,
    private readonly config: Pick<Config, "chatPeerUserIds" | "pollIntervalMs">,
    private readonly store: TransportStateStore,
    private readonly agent: BasedBotAgent,
    private readonly discoveryStore?: ConversationDiscoveryStore,
  ) {}

  async run(): Promise<never> {
    log("info", "xchat_agent_started", { botUserId: this.botUserId, pollIntervalMs: this.config.pollIntervalMs });
    for (;;) {
      try { await this.poll(); }
      catch (error) { log("error", "poll_failed", { error: errorMessage(error) }); }
      await Bun.sleep(this.config.pollIntervalMs);
    }
  }

  async poll(): Promise<void> {
    const conversations = new Set(await this.discoverConversations());
    for (const peerUserId of this.config.chatPeerUserIds) {
      try {
        let conversationId = this.resolvedPeerConversations.get(peerUserId);
        if (!conversationId) {
          conversationId = await this.api.conversationId(peerUserId);
          this.resolvedPeerConversations.set(peerUserId, conversationId);
        }
        conversations.add(conversationId);
      } catch (error) {
        log("warn", "peer_conversation_lookup_failed", { peerUserId, error: errorMessage(error) });
        if (error instanceof ApiError && (error.status === 429 || error.status === 401)) throw error;
      }
    }
    for (const conversationId of conversations) {
      try { await this.pollConversation(conversationId); }
      catch (error) {
        log("warn", "conversation_poll_failed", { conversationId, error: errorMessage(error) });
        throw error;
      }
    }
    await this.drainOutbox();
  }

  private async discoverConversations(): Promise<readonly string[]> {
    const cached = this.discovery ?? await this.discoveryStore?.get();
    if (cached && Date.now() < cached.refreshAt) return cached.ids;
    let discovery: ConversationDiscovery;
    try {
      const listed = await this.api.conversations();
      discovery = { ids: listed.map((item) => item.id), refreshAt: Date.now() + 5 * 60_000 };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 429) throw error;
      if (!cached?.ids.length && this.config.chatPeerUserIds.length === 0) throw error;
      discovery = {
        ids: cached?.ids ?? [],
        refreshAt: Date.now() + nextXApiPollDelayMs(error, this.config.pollIntervalMs, 5 * 60_000),
      };
      log("warn", "conversation_discovery_backoff", { refreshAt: discovery.refreshAt });
    }
    this.discovery = discovery;
    await this.discoveryStore?.put(discovery);
    return discovery.ids;
  }

  async ingestActivity(body: unknown, requireCompletion = false): Promise<boolean> {
    const activity = activityConversation(body);
    if (!activity) return false;
    log("info", "activity_received", { eventType: activity.eventType, hasEncodedEvent: Boolean(activity.encodedEvent), hasKeyChangeEvent: Boolean(activity.keyChangeEvent) });
    let conversationId = activity.conversationId;
    if (!conversationId && activity.senderId && activity.senderId !== this.botUserId) {
      conversationId = await this.api.conversationId(activity.senderId);
    }
    if (!conversationId) return false;
    if (activity.encodedEvent && activity.senderId) {
      await this.loadSigningKeys([this.botUserId, activity.senderId]);
      const events = activity.keyChangeEvent ? [activity.keyChangeEvent, activity.encodedEvent] : [activity.encodedEvent];
      const decrypted = this.chat.decryptEvents(events);
      const message = decrypted.messages.find((item) => item.originalB64 === activity.encodedEvent);
      log("info", "activity_decoded", { eventId: message?.event.id, verified: message?.event.verified, type: message?.event.type, errors: Object.values(decrypted.errors).map((error) => error.slice(0, 300)) });
      if (!message) {
        await this.pollConversation(conversationId.replaceAll(":", "-"));
      } else {
        await this.dispatch(conversationId, { senderId: activity.senderId, conversationId }, message.event, activity.encodedEvent, false, requireCompletion);
      }
    } else {
      await this.pollConversation(conversationId.replaceAll(":", "-"));
    }
    await this.drainOutbox();
    return true;
  }

  private async loadSigningKeys(userIds: readonly string[]): Promise<void> {
    for (const userId of new Set(userIds)) {
      if (!this.knownKeys.has(userId)) this.knownKeys.set(userId, signingKeys(userId, await this.api.publicKeys(userId)));
    }
    this.chat.setSigningKeys([...this.knownKeys.values()].flat());
  }

  private async pollConversation(conversationId: string): Promise<void> {
    const initialized = this.store.transportInitialized(conversationId, transportBootstrapVersion);
    const page = await this.api.events(conversationId);
    const raw = page.data ?? [];
    const senderIds = raw.map((item) => item.senderId).filter((id): id is string => Boolean(id));
    await this.loadSigningKeys([this.botUserId, ...senderIds]);
    const encoded = raw.map((item) => item.encodedEvent).filter((item): item is string => Boolean(item));
    const keyEvents = page.meta?.conversationKeyEvents ?? [];
    const decrypted = this.chat.decryptEvents([...keyEvents, ...encoded]);
    log("info", "conversation_poll_decoded", {
      conversationId,
      events: raw.length,
      encodedEvents: encoded.length,
      messages: decrypted.messages.length,
      verifiedMessages: decrypted.messages.filter((item) => item.event.verified === true).length,
      decryptionErrors: Object.values(decrypted.errors).map((error) => error.slice(0, 300)),
    });
    if (raw.length > 0 && encoded.length === 0) throw new Error("X returned events without encrypted payloads");
    if (encoded.length > 0 && decrypted.messages.length === 0 && Object.keys(decrypted.errors).length > 0) {
      throw new Error("X Chat events could not be decrypted");
    }
    const outerByEncoded = new Map(raw.flatMap((item) => item.encodedEvent ? [[item.encodedEvent, item] as const] : []));
    const bootstrapMessageId = initialized
      ? undefined
      : latestRecentInboundMessageId(decrypted.messages, this.botUserId);
    for (const item of decrypted.messages) {
      if (!item.originalB64) continue;
      const outer = outerByEncoded.get(item.originalB64);
      if (!outer) continue;
      if (!initialized && item.event.id !== bootstrapMessageId) {
        if (item.event.id && item.event.senderId) this.store.ignoreEvent(item.event.id, item.event.conversationId ?? conversationId, item.event.senderId);
        continue;
      }
      await this.dispatch(conversationId, outer, item.event, item.originalB64, !initialized);
    }
    if (!initialized) this.store.savePaginationToken(conversationId, transportBootstrapVersion);
  }

  private async dispatch(conversationId: string, outer: { id?: string; senderId?: string; conversationId?: string }, event: Event, encodedEvent: string, retryUnanswered = false, requireCompletion = false): Promise<void> {
    if (event.type !== "message" || event.verified !== true) return;
    const eventId = event.id;
    const senderId = event.senderId;
    const innerConversation = event.conversationId;
    const text = event.content?.text;
    if (!eventId || !senderId || !innerConversation || !text || senderId === this.botUserId) return;
    if (!outer.senderId || outer.senderId !== senderId) throw new Error("outer and decrypted sender IDs differ");
    const outerConversation = outer.conversationId ?? conversationId;
    if (comparableConversation(outerConversation) !== comparableConversation(innerConversation)) throw new Error("outer and decrypted conversation IDs differ");
    const startedAt = Date.now();
    log("info", "message_dispatch_started", { eventId, ageMs: event.createdAtMsec ? startedAt - event.createdAtMsec : undefined });
    const reply = await this.agent.handle(
      { eventId, senderId, conversationId: innerConversation, text, encodedEvent, replyConfirmationCode: replyConfirmationCode(event, this.botUserId, this.store) },
      retryUnanswered,
    );
    if (reply === undefined && requireCompletion) throw new Error("Chat event is still processing; retry after its lease expires");
    log("info", "message_dispatch_completed", { eventId, elapsedMs: Date.now() - startedAt, hasReply: Boolean(reply) });
    if (reply) this.store.enqueueReply(`reply:${eventId}`, innerConversation, encodedEvent, reply);
  }

  private async drainOutbox(): Promise<void> {
    const pending = this.store.pendingReplies();
    for (const reply of pending) {
      try {
        const startedAt = Date.now();
        log("info", "reply_send_started", { outboxId: reply.id });
        const payload = reply.payloadJson
          ? JSON.parse(reply.payloadJson) as SendPayload
          : this.chat.encryptReply({ conversationId: reply.conversationId, text: reply.text, replyToEvent: reply.replyToEvent });
        if (!reply.payloadJson) this.store.prepareReply(reply.id, JSON.stringify(payload));
        await this.api.send(reply.conversationId, payload);
        this.store.sentReply(reply.id);
        log("info", "reply_send_completed", { outboxId: reply.id, elapsedMs: Date.now() - startedAt });
      } catch (error) {
        this.store.failReply(reply.id, errorMessage(error));
        log("warn", "reply_send_failed", { outboxId: reply.id, conversationId: reply.conversationId, error: errorMessage(error) });
        throw error;
      }
    }
  }
}
