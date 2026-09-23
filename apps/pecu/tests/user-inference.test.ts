import { expect, test } from "bun:test";
import { inferenceStatusSchema } from "../src/web-contract";

test("per-user inference isolates credentials and fails closed", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/user-inference-check.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("isolation, OpenRouter fallback");
});

test("profile contract removes internal identifiers and rejects unsafe login URLs", () => {
  const status = { model: "gpt-6-sol", reasoning: "medium", connected: false, checkedAt: 1, lastResponse: null, loginState: "pending", login: { url: "https://auth.openai.com/codex/device", instructions: "Test code", expiresAt: 2, attemptId: "private", accessToken: "must-not-leak" } };
  expect(inferenceStatusSchema.parse(status).login).not.toHaveProperty("attemptId");
  expect(inferenceStatusSchema.parse(status).login).not.toHaveProperty("accessToken");
  expect(inferenceStatusSchema.parse(status).fallback).toBeUndefined();
  expect(inferenceStatusSchema.parse({ ...status, fallback: { configured: true, active: false } }).fallback).toEqual({ configured: true, active: false });
  for (const url of ["javascript:alert(1)", "https://auth.openai.com.evil.test", "http://auth.openai.com"]) {
    expect(inferenceStatusSchema.safeParse({ ...status, login: { ...status.login, url } }).success).toBe(false);
  }
});
