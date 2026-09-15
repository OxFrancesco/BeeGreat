import { z } from "zod";

const repository = "https://github.com/OxFrancesco/aerodrome-sdk-ts";
const manifest = z.object({
  dependencies: z.object({
    "@beegreat/sugar": z.string().startsWith("github:OxFrancesco/aerodrome-sdk-ts#"),
  }),
}).parse(await Bun.file(new URL("../package.json", import.meta.url)).json());
const pinned = manifest.dependencies["@beegreat/sugar"]?.split("#")[1];
if (!pinned || !/^[a-f0-9]{40}$/.test(pinned)) {
  throw new Error("Pin @beegreat/sugar to a full published commit before verifying it");
}

const command = Bun.spawn(["git", "ls-remote", repository, "HEAD"], {
  stdout: "pipe",
  stderr: "pipe",
});
const timeout = setTimeout(() => command.kill(), 20_000);
try {
  const [output, error, status] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  if (status !== 0) throw new Error(`Could not check published Aero HEAD: ${error.trim()}`);
  const latest = output.trim().split(/\s+/)[0];
  if (latest !== pinned) throw new Error(`Aero update available: pinned ${pinned}, published ${latest}`);
  console.log(`Aero SDK and sugar-ts CLI match published HEAD ${pinned}`);
} finally {
  clearTimeout(timeout);
}
