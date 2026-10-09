import { z } from "zod";

const usage = "Usage: bun scripts/waitlist.ts list | csv | remove EMAIL";
const [command, email] = process.argv.slice(2);
if (!command || !["list", "csv", "remove"].includes(command) || (command === "remove") !== Boolean(email)) throw new Error(usage);

let admin = process.env.ADMIN_TOKEN;
if (!admin) {
  const keychain = Bun.spawn(["security", "find-generic-password", "-s", "com.oddofrancesco.basedbot.admin-token", "-w"], { stdout: "pipe", stderr: "pipe" });
  const [token] = await Promise.all([new Response(keychain.stdout).text(), new Response(keychain.stderr).text()]);
  if (await keychain.exited === 0) admin = token.trim();
}
if (!admin) throw new Error("Set ADMIN_TOKEN or store it in the keychain item com.oddofrancesco.basedbot.admin-token");
const origin = process.env.PECU_ADMIN_ORIGIN ?? "https://basedbot.oddofrancesco000.workers.dev";
if (new URL(origin).origin !== origin) throw new Error("Use an origin without a path");
const headers = { Authorization: `Bearer ${admin}`, "Content-Type": "application/json" };

if (command === "remove") {
  const response = await fetch(`${origin}/admin/waitlist/remove`, { method: "POST", headers, body: JSON.stringify({ email }) });
  if (!response.ok) throw new Error(`Removal failed: HTTP ${response.status}`);
  const { status } = z.object({ status: z.enum(["removed", "missing"]) }).parse(await response.json());
  console.log(status === "removed" ? "Removed." : "That email is not on the waitlist.");
} else {
  const response = await fetch(`${origin}/admin/waitlist`, { headers });
  if (!response.ok) throw new Error(`Export failed: HTTP ${response.status}`);
  const { signups } = z.object({ signups: z.object({ email: z.string(), consent: z.string(), joinedAt: z.string() }).array() }).parse(await response.json());
  if (command === "list") console.log(JSON.stringify(signups, null, 2));
  else {
    const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    console.log(["email,consent,joined_at", ...signups.map((row) => [row.email, row.consent, row.joinedAt].map(cell).join(","))].join("\n"));
  }
}
