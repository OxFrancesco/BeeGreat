import { expect, test } from "bun:test";
import { FcmSender, serviceAccountAssertion, type ServiceAccount } from "../src/integrations/fcm";

async function account(): Promise<{ account: ServiceAccount; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  return { account: { project_id: "pecu-app-test", client_email: "push@pecu-app-test.iam.gserviceaccount.com", private_key: pem }, publicKey: pair.publicKey };
}

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

test("the OAuth assertion is an RS256 JWT for the FCM scope that verifies with the account key", async () => {
  const { account: key, publicKey } = await account();
  const jwt = await serviceAccountAssertion(key, 1_800_000_000_000);
  const [header, claims, signature] = jwt.split(".");
  expect(decode(header!)).toEqual({ alg: "RS256", typ: "JWT" });
  expect(decode(claims!)).toEqual({ iss: key.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: 1_800_000_000, exp: 1_800_003_600 });
  expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(signature!, "base64url"), new TextEncoder().encode(`${header}.${claims}`))).toBe(true);
});

test("sends data-only messages, reuses the access token and reports unregistered devices", async () => {
  const { account: key } = await account();
  const requests: Array<{ url: string; body: string; authorization: string | null }> = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const body = await request.text();
    requests.push({ url: request.url, body, authorization: request.headers.get("Authorization") });
    if (request.url.startsWith("https://oauth2.googleapis.com/")) return Response.json({ access_token: "access-1", expires_in: 3600 });
    if (body.includes("stale-token")) return Response.json({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }, { status: 404 });
    return Response.json({ name: "projects/pecu-app-test/messages/1" });
  };
  const sender = new FcmSender(key, Object.assign(fetcher, { preconnect() {} }), () => 1_800_000_000_000);
  const message = { title: "Buy NVDA: confirm the transaction", body: "YOLO is off in this chat.", tag: "task:ABC234:1", kind: "approval" as const, code: "ABC234", threadId: "t1", channel: "web" as const };
  expect(await sender.send(["good-token-0123456789", "stale-token-0123456789"], message)).toEqual(["stale-token-0123456789"]);
  expect(await sender.send(["good-token-0123456789"], message)).toEqual([]);
  expect(requests.filter((request) => request.url.includes("oauth2")).length).toBe(1);
  const sent = requests.find((request) => request.url.includes("fcm.googleapis.com"))!;
  expect(sent.url).toBe("https://fcm.googleapis.com/v1/projects/pecu-app-test/messages:send");
  expect(sent.authorization).toBe("Bearer access-1");
  const payload = JSON.parse(sent.body).message;
  expect(payload.notification).toBeUndefined();
  expect(payload.fid).toBe("good-token-0123456789");
  expect(payload.token).toBeUndefined();
  expect(payload.data).toEqual({ title: message.title, body: message.body, tag: message.tag, kind: "approval", code: "ABC234", channel: "web", threadId: "t1" });
  expect(payload.android).toEqual({ priority: "HIGH", ttl: "3600s", collapse_key: "task:ABC234:1" });
});

test("a missing or malformed secret leaves push off", () => {
  expect(FcmSender.fromSecret(undefined)).toBeUndefined();
  expect(FcmSender.fromSecret("{not json")).toBeUndefined();
});
