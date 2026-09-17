import { expect, test } from "bun:test";

test("OpenCode switches models for each turn without losing the conversation", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/model-routing-check.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("Luna selection, retained session, Sol fallback, response instructions, usage-limit short-circuit, OpenRouter fallback passed");
});
