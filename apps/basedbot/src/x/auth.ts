import type { Config } from "../config";

export async function getXAccessToken(config: Pick<Config, "xAccessToken" | "xurlApp" | "xurlUsername">): Promise<string> {
  if (config.xAccessToken) return config.xAccessToken;
  const args = ["token"];
  if (config.xurlApp) args.push("--app", config.xurlApp);
  if (config.xurlUsername) args.push("--username", config.xurlUsername);
  const child = Bun.spawn(["xurl", ...args], { stdout: "pipe", stderr: "pipe", env: Bun.env });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (exitCode !== 0) throw new Error(`xurl could not provide an OAuth token: ${stderr.trim() || `exit ${exitCode}`}`);
  const token = stdout.trim();
  if (!token || token.includes("\n")) throw new Error("xurl returned an invalid OAuth token");
  return token;
}
