import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createChat } from "@xdevplatform/chat-xdk";
import { loadConfig } from "../src/config";
import { getXAccessToken } from "../src/x/auth";
import { XApi } from "../src/x/api";
import { realmTokens } from "../src/x/chat";

const markerPath = ".data/xchat-registration.json";

async function marker(): Promise<{ registered?: boolean } | undefined> {
  try { return JSON.parse(await readFile(markerPath, "utf8")) as { registered?: boolean }; }
  catch { return undefined; }
}

function weakPin(pin: string): string | undefined {
  if (new TextEncoder().encode(pin).length < 4) return "must be at least four characters";
  if (/^(.)\1+$/.test(pin)) return "cannot repeat one character";
  if (/^(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/.test(pin)) return "cannot be a sequential digit run";
  return undefined;
}

if (!process.argv.includes("--confirm")) {
  console.error("This performs the rare, rate-limited XChat public-key registration. Re-run with: bun run xchat:setup --confirm");
  process.exit(1);
}

const config = loadConfig();
const weak = weakPin(config.chatPin);
if (weak) throw new Error(`CHAT_PIN ${weak}`);
if ((await marker())?.registered) throw new Error(`XChat is already registered according to ${markerPath}`);

const api = new XApi(await getXAccessToken(config));
const userId = config.chatBotUserId ?? await api.me();
const existing = await api.publicKeys(userId);
if (existing.length > 0) {
  const juicebox = await api.juicebox(userId);
  const tokens = realmTokens(juicebox.json);
  const chat = await createChat({ juiceboxConfig: juicebox.json, getAuthToken: async (realm) => tokens.get(realm.toLowerCase()) ?? "" });
  await chat.unlock(config.chatPin);
  await mkdir(".data", { recursive: true });
  await writeFile(markerPath, JSON.stringify({ registered: true, userId, version: juicebox.version, adoptedAt: new Date().toISOString() }, null, 2));
  console.log(`Adopted the existing XChat key version ${juicebox.version}; no registration write was made.`);
  process.exit(0);
}

const tokens = new Map<string, string>();
const chat = await createChat({ getAuthToken: async (realm) => tokens.get(realm.toLowerCase()) ?? "" });
const registration = chat.generateKeypairs();
await api.addPublicKey(userId, api.registrationBody(registration));
const juicebox = await api.juicebox(userId);
for (const [realm, token] of realmTokens(juicebox.json)) tokens.set(realm, token);
chat.updateConfig(juicebox.json);
try {
  await chat.setup(config.chatPin);
} catch (error) {
  throw new Error(`The public key was registered but Juicebox setup failed. Do not retry blindly; the registered key may need replacement. Cause: ${error instanceof Error ? error.message : String(error)}`);
}
await mkdir(".data", { recursive: true });
await writeFile(markerPath, JSON.stringify({ registered: true, userId, version: juicebox.version, registeredAt: new Date().toISOString() }, null, 2));
console.log(`XChat registration complete for user ${userId}, key version ${juicebox.version}.`);
