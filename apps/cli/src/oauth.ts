import { createHash, randomBytes } from "node:crypto";

function base64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function randomState() {
  return base64Url(randomBytes(32));
}
