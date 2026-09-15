import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { env } from "cloudflare:workers";
import { verifiedXAccount } from "../../../../src/web-identity";

export async function identity() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in with X to use your Pecu wallet.");
  const user = await clerkClient().users.getUser(userId);
  return { userId, senderId: verifiedXAccount(user.externalAccounts) };
}
export async function agentRequest(
  path: string,
  body: unknown,
): Promise<Response> {
  const binding: unknown = Reflect.get(env, "PECU");
  if (
    !binding ||
    typeof binding !== "object" ||
    !("fetch" in binding) ||
    typeof binding.fetch !== "function"
  )
    throw new Error("Agent connection is unavailable.");
  return binding.fetch(`https://pecu.internal/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
export function sameOrigin(request: Request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}
