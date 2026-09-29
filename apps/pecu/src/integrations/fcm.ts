import { z } from "zod";
import type { JsonInput } from "../json-contract";
import { log } from "../logger";
import type { PushMessage, PushSender } from "../proactive";

/** The fields Pecu needs from a Google service-account key file. */
export const serviceAccountSchema = z.object({
  project_id: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
  client_email: z.string().email(),
  private_key: z.string().includes("PRIVATE KEY"),
});
export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

const tokenUrl = "https://oauth2.googleapis.com/token";
const scope = "https://www.googleapis.com/auth/firebase.messaging";
const tokenResponseSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().int().positive() });
const errorSchema = z.object({ error: z.object({ status: z.string().optional(), details: z.array(z.object({ errorCode: z.string().optional() })).optional() }) });

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

const encodeJson = (value: JsonInput) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

function pemBytes(pem: string): ArrayBuffer {
  const body = pem.replace(/-----(?:BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

/** RS256 service-account assertion for Google's OAuth token endpoint. */
export async function serviceAccountAssertion(account: ServiceAccount, now: number): Promise<string> {
  const iat = Math.floor(now / 1000);
  const header = encodeJson({ alg: "RS256", typ: "JWT" });
  const claims = encodeJson({ iss: account.client_email, scope, aud: tokenUrl, iat, exp: iat + 3600 });
  const key = await crypto.subtle.importKey("pkcs8", pemBytes(account.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

/**
 * Sends data-only FCM HTTP v1 messages to Firebase Installation IDs, which
 * replaced registration tokens as FCM's device target. The Android app builds
 * the visible notification itself so it can reuse the tag a local reminder
 * alarm used.
 */
export class FcmSender implements PushSender {
  private accessToken?: { value: string; expiresAt: number };

  constructor(
    private readonly account: ServiceAccount,
    private readonly fetcher: typeof fetch = fetch,
    private readonly clock: () => number = Date.now,
  ) {}

  static fromSecret(secret: string | undefined): FcmSender | undefined {
    if (!secret) return undefined;
    const parsed = serviceAccountSchema.safeParse((() => { try { return JSON.parse(secret); } catch { return null; } })());
    if (!parsed.success) {
      log("error", "fcm_service_account_invalid", {});
      return undefined;
    }
    return new FcmSender(parsed.data);
  }

  private async token(): Promise<string> {
    const now = this.clock();
    if (this.accessToken && this.accessToken.expiresAt > now + 60_000) return this.accessToken.value;
    const response = await this.fetcher(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await serviceAccountAssertion(this.account, now) }),
    });
    if (!response.ok) throw new Error(`Google OAuth returned HTTP ${response.status}`);
    const body = tokenResponseSchema.parse(await response.json());
    this.accessToken = { value: body.access_token, expiresAt: now + body.expires_in * 1000 };
    return body.access_token;
  }

  async send(tokens: readonly string[], message: PushMessage): Promise<string[]> {
    const access = await this.token();
    const gone: string[] = [];
    await Promise.all(tokens.map(async (token) => {
      const response = await this.fetcher(`https://fcm.googleapis.com/v1/projects/${this.account.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            fid: token,
            data: { title: message.title, body: message.body, tag: message.tag, kind: message.kind, code: message.code, channel: message.channel, threadId: message.threadId ?? "" },
            android: { priority: "HIGH", ttl: "3600s", collapse_key: message.tag },
          },
        }),
      });
      if (response.ok) return;
      const detail = errorSchema.safeParse(await response.json().catch(() => null)).data?.error;
      const codes = detail?.details?.map((item) => item.errorCode) ?? [];
      if (response.status === 404 || codes.includes("UNREGISTERED") || (response.status === 400 && codes.includes("INVALID_ARGUMENT"))) {
        gone.push(token);
        return;
      }
      log("warn", "fcm_send_failed", { status: response.status, reason: detail?.status });
    }));
    return gone;
  }
}
