import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("collector sends exactly 1000 metered requests and resumes without another request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pecu-nansen-test-"));
  try {
    const run = async () => {
      const child = Bun.spawn(["bun", "--preload", "./tests/fixtures/nansen-collector-preload.ts", "./scripts/nansen/collect.ts", directory], { env: { ...process.env, NANSEN_API_KEY: "test-only" }, stdout: "pipe", stderr: "pipe" });
      const [output, errors, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if (code) throw new Error(errors + output.slice(-2000));
      return await Bun.file(join(directory, "requests.jsonl")).text();
    };
    const first = await run();
    const rows = first.trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.filter((row) => row.phase === "started")).toHaveLength(1000);
    expect(rows.filter((row) => row.phase === "finished" && row.status === 200)).toHaveLength(1000);
    expect((await Bun.file(join(directory, "summary.json")).json()).credits).toBe(1000);
    expect(await run()).toBe(first);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 20000);

for (const failure of ["auth", "cost"]) {
  test(`collector stops after ${failure} without retrying`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "pecu-nansen-stop-"));
    try {
      const child = Bun.spawn(["bun", "--preload", "./tests/fixtures/nansen-collector-preload.ts", "./scripts/nansen/collect.ts", directory], { env: { ...process.env, NANSEN_API_KEY: "test-only", NANSEN_TEST_FAILURE: failure }, stdout: "ignore", stderr: "ignore" });
      expect(await child.exited).not.toBe(0);
      const rows = (await Bun.file(join(directory, "requests.jsonl")).text()).trim().split("\n").map((line) => JSON.parse(line));
      expect(rows.filter((row) => row.phase === "started")).toHaveLength(1);
      expect(rows.filter((row) => row.phase === "finished")).toHaveLength(1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
