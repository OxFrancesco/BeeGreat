import { expect, test } from "bun:test";

test("the actual streaming route admits steering during an active turn", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/steering-route-check.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out).toContain("streaming route admits steering");
});
