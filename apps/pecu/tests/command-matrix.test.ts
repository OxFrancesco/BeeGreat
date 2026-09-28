import { expect, test } from "bun:test";
import { parseCommand } from "../src/domain";
import { validateFilters } from "../src/integrations/polymarket/endpoint";
import { commandCases } from "./fixtures/command-cases";
import { jsonObjectSchema } from "../src/json-contract";

test.each(commandCases)("command grammar: $command", row => {
  const result = parseCommand(row.command);
  expect(result.type).toBe(row.type);
  if ("action" in row) expect(result).toMatchObject({ action: row.action });
  if ("endpoint" in row) expect(result).toMatchObject({ endpoint: row.endpoint });
  if (result.type === "polymarket-read") expect(() => validateFilters(result.endpoint, jsonObjectSchema.parse(result.input))).not.toThrow();
});

test("YOLO never accepts a bare permission-changing command", () => {
  for (const input of ["yolo", "yolo on", "yolo off"]) expect(() => parseCommand(input)).toThrow();
});

test("every parser verb has a command recipe", async () => {
  const source = await Bun.file(new URL("../src/domain.ts", import.meta.url)).text();
  const verbs = new Set([...source.matchAll(/\bverb === "([^"]+)"/g)].map(match => match[1]));
  const covered = new Set(commandCases.map(row => row.command.replace(/^(?:b)?\//, "").split(" ")[0]));
  for (const verb of verbs) expect(covered.has(verb), verb).toBe(true);
});
