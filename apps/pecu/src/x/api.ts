import { Client } from "@xdevplatform/xdk";
import type { PublicKeyRegistrationPayload, SendPayload } from "@xdevplatform/chat-xdk";

export type PublicKeyRecord = Readonly<{
  publicKey?: string;
  public_key?: string;
  signingPublicKey?: string;
  signing_public_key?: string;
  identityPublicKeySignature?: string;
  identity_public_key_signature?: string;
  publicKeyVersion?: string;
  public_key_version?: string;
  juiceboxConfig?: unknown;
  juicebox_config?: unknown;
}>;

export class XApi {
  readonly client: Client;
  constructor(private readonly accessToken: string) { this.client = new Client({ accessToken, retry: false, timeout: 30_000 }); }

  async identity() {
    const response = await this.client.users.getMe();
    if (!response.data?.id) throw new Error("X did not return the authenticated user ID");
    return { id: String(response.data.id), username: response.data.username, name: response.data.name };
  }

  async me(expectedUserId?: string): Promise<string> {
    const identity = await this.identity();
    if (expectedUserId && identity.id !== expectedUserId) {
      throw new Error(`X account mismatch: authenticated as ${identity.id}, expected ${expectedUserId}`);
    }
    return identity.id;
  }

  async publicKeys(userId: string): Promise<PublicKeyRecord[]> {
    const response = await this.client.users.getPublicKey(userId, {
      publicKeyFields: ["public_key", "public_key_version", "signing_public_key", "identity_public_key_signature", "juicebox_config"],
    });
    const data = response.data ?? [];
    return Array.isArray(data) ? data : [data];
  }

  async addPublicKey(userId: string, body: Parameters<Client["chat"]["addUserPublicKey"]>[1]) {
    return this.client.chat.addUserPublicKey(userId, body);
  }

  async conversations(): Promise<Array<{ id: string; participantIds: readonly string[] }>> {
    const response = await this.client.chat.getConversations({ maxResults: 100 });
    return (response.data ?? []).flatMap((item) => item.id ? [{ id: item.id, participantIds: item.participantIds ?? item.memberIds ?? [] }] : []);
  }

  async conversationId(peerUserId: string): Promise<string> {
    const response = await this.client.chat.getConversation(peerUserId);
    if (!response.data?.id) throw new Error(`X did not return a conversation ID for peer ${peerUserId}`);
    return String(response.data.id);
  }

  async events(conversationId: string) {
    return this.client.chat.getConversationEvents(conversationId.replaceAll(":", "-"), {
      maxResults: 100,
      chatMessageEventFields: ["id", "sender_id", "conversation_id", "encoded_event", "created_at", "message_event_signature"],
    });
  }

  async send(conversationId: string, payload: SendPayload): Promise<void> {
    await this.client.chat.sendMessage(conversationId.replaceAll(":", "-"), {
      messageId: payload.messageId,
      encodedMessageCreateEvent: payload.encryptedContent,
      encodedMessageEventSignature: payload.encodedEventSignature,
    });
  }

  async juicebox(userId: string): Promise<{ json: string; version: string }> {
    const keys = await this.publicKeys(userId);
    const latest = keys.reduce<PublicKeyRecord | undefined>((best, item) => this.version(item) >= this.version(best) ? item : best, undefined);
    const config = latest?.juiceboxConfig ?? latest?.juicebox_config;
    if (!config) throw new Error("No XChat Juicebox configuration exists. Run `bun run xchat:setup --confirm` once.");
    return { json: JSON.stringify(config), version: String(latest?.publicKeyVersion ?? latest?.public_key_version ?? "1") };
  }

  registrationBody(registration: PublicKeyRegistrationPayload): Parameters<Client["chat"]["addUserPublicKey"]>[1] {
    return {
      publicKey: {
        publicKey: registration.publicKey.publicKey,
        signingPublicKey: registration.publicKey.signingPublicKey,
        identityPublicKeySignature: registration.publicKey.identityPublicKeySignature,
        signingPublicKeySignature: registration.publicKey.signingPublicKeySignature,
        registrationMethod: registration.publicKey.registrationMethod,
      },
      version: String(registration.version ?? "1"),
      generateVersion: Boolean(registration.generateVersion),
    };
  }

  private version(key: PublicKeyRecord | undefined): number { return Number(key?.publicKeyVersion ?? key?.public_key_version ?? 0); }
}
