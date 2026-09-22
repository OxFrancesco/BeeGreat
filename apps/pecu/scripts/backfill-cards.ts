import { z } from "zod";
import { webSenderId } from "../src/web-identity";

const userSchema = z.object({
  id: z.string(),
  external_accounts: z.array(z.object({
    provider: z.string(), provider_user_id: z.string(),
    verification: z.object({ status: z.string() }).nullable(),
  })),
});
const appId = process.env.PECU_CARDS_CLERK_APP;
const instanceId = process.env.PECU_CARDS_CLERK_INSTANCE;
const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!appId || !instanceId || !publishableKey) throw new Error("Set PECU_CARDS_CLERK_APP, PECU_CARDS_CLERK_INSTANCE, and the frontend VITE_CLERK_PUBLISHABLE_KEY");
const apply = process.argv.includes("--apply");
let admin = process.env.ADMIN_TOKEN;
if (apply && !admin) {
  const keychain = Bun.spawn(["security", "find-generic-password", "-s", "com.oddofrancesco.basedbot.admin-token", "-w"], { stdout: "pipe", stderr: "pipe" });
  const [token] = await Promise.all([new Response(keychain.stdout).text(), new Response(keychain.stderr).text()]);
  if (await keychain.exited === 0) admin = token.trim();
}
if (apply && !admin) throw new Error("ADMIN_TOKEN is required for --apply");
const origin = process.env.PECU_CARDS_AGENT_URL ?? "https://basedbot.oddofrancesco000.workers.dev";
if (new URL(origin).origin !== origin) throw new Error("Use an origin without a path");
async function clerk(args: string[]): Promise<unknown> {
  const child = Bun.spawn(["clerk", ...args, "--json"], { stdout: "pipe", stderr: "pipe" });
  const [output] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  if (await child.exited !== 0) throw new Error("Clerk CLI request failed");
  return JSON.parse(output);
}
const applications = z.array(z.object({ application_id: z.string(), instances: z.array(z.object({ instance_id: z.string(), publishable_key: z.string() })) })).parse(await clerk(["apps", "list"]));
const matched = applications.find(a => a.application_id === appId)?.instances.find(i => i.instance_id === instanceId);
if (matched?.publishable_key !== publishableKey) throw new Error("Clerk instance does not match the frontend publishable key");
const eligible: { userId: string; xId: string }[] = [];
let scanned = 0;
let ambiguous = 0;
for (let offset = 0; ; offset += 100) {
  const page = z.object({ data: userSchema.array() }).parse(await clerk(["users", "list", "--app", appId, "--instance", instanceId, "--limit", "100", "--offset", String(offset), "--order-by", "+created_at"]));
  const users = page.data;
  scanned += users.length;
  for (const user of users) {
    try {
      const sender = webSenderId(user.id, user.external_accounts.map((a) => ({ provider: a.provider, providerUserId: a.provider_user_id, verification: a.verification })));
      if (!sender.startsWith("web-")) eligible.push({ userId: user.id, xId: sender });
    } catch { ambiguous++; }
  }
  if (users.length < 100) break;
}
let granted = 0;
let owned = 0;
let soldOut = false;
if (apply) {
  for (let offset = 0; offset < eligible.length; offset += 50) {
    const response = await fetch(`${origin}/admin/cards/backfill`, {
      method: "POST", headers: { Authorization: `Bearer ${admin}`, "Content-Type": "application/json" },
      body: JSON.stringify(eligible.slice(offset, offset + 50)),
    });
    if (!response.ok) throw new Error(`Backfill failed: HTTP ${response.status}. Rerunning is safe.`);
    const result = z.object({ granted: z.number(), owned: z.number(), soldOut: z.boolean() }).parse(await response.json());
    granted += result.granted;
    owned += result.owned;
    soldOut ||= result.soldOut;
  }
}
console.log(JSON.stringify({ mode: apply ? "apply" : "preview", scanned, eligible: eligible.length, ambiguous, granted, owned, soldOut }));
