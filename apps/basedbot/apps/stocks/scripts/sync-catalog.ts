import { dirname, join } from "node:path";
const { STOCKS } = await import(new URL("./stocks/catalog.ts", import.meta.resolve("@beegreat/sugar")).href);
await Bun.write(
  join(dirname(import.meta.path), "../src/lib/catalog.ts"),
  `// Generated from the pinned Aero SDK. Run bun run catalog to refresh.\nexport const catalog = ${JSON.stringify(STOCKS, null, 2)};\n`,
);
