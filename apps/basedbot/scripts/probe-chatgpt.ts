import { probeChatGptBoundary } from "../src/cloudflare/provider-probe";

if (process.argv.includes("--local-boundary")) {
  console.log(JSON.stringify(await probeChatGptBoundary(), null, 2));
} else {
  const keychain = Bun.spawn(["security", "find-generic-password", "-s", "com.oddofrancesco.basedbot.admin-token", "-w"], { stdout: "pipe", stderr: "pipe" });
  const token = (await new Response(keychain.stdout).text()).trim();
  if (await keychain.exited !== 0 || !token) throw new Error("BasedBot admin token is unavailable");
  const path = process.argv.includes("--tools") ? "tools" : "probe";
  const response = await fetch(`https://basedbot.oddofrancesco000.workers.dev/admin/opencode/${path}`, {
    method: path === "tools" ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  console.log(response.status, await response.text());
  if (!response.ok) process.exitCode = 1;
}
