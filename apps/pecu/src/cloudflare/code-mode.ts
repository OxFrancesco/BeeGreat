import { CodeMode, Tool } from "@opencode-ai/codemode";
import type { Result, ToolContext } from "@opencode-ai/plugin/promise/tool";
import { Effect, Schema } from "effect";
import { z } from "zod";
import { jsonValueSchema, type JsonValue } from "../json-contract";

export const codeModeName = "run_tools";
export const directTools = new Set(["ask_user", "load_skills", "aero_liquidity", "research_findings", "research_report"]);
import { codeModeCallsSchema } from "../progress";
type Call = z.infer<typeof codeModeCallsSchema>[number];
type Registration<Input extends z.ZodType> = {
  name: string; description: string; input: Input;
  options: { codemode: false };
  execute: (input: z.output<Input>, context: ToolContext) => Promise<Result>;
};
type Entry = {
  name: string; description: string; input: Tool.JsonSchema;
  execute: (input: JsonValue, context: ToolContext) => Promise<string>;
};

const catalogSchema: z.ZodType<Tool.JsonSchema> = z.lazy(() => z.object({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  properties: z.record(z.string(), catalogSchema).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.union([z.boolean(), catalogSchema]).optional(),
  items: catalogSchema.optional(), enum: z.array(jsonValueSchema).optional(),
  anyOf: z.array(catalogSchema).optional(), oneOf: z.array(catalogSchema).optional(),
  allOf: z.array(catalogSchema).optional(), const: jsonValueSchema.optional(),
  description: z.string().optional(), default: jsonValueSchema.optional(),
  minimum: z.number().optional(), maximum: z.number().optional(),
  exclusiveMinimum: z.number().optional(), exclusiveMaximum: z.number().optional(),
  minLength: z.number().optional(), maxLength: z.number().optional(), pattern: z.string().optional(),
  minItems: z.number().optional(), maxItems: z.number().optional(),
  $ref: z.string().optional(), $defs: z.record(z.string(), catalogSchema).optional(),
}));

const guidance = `Use run_tools for tool calls, including single calls. Write plain JavaScript with top-level await and return.
Call only exact tools listed below, using tools.NAME(input). Every tool returns a string. Parse JSON strings with JSON.parse before accessing fields; some tools return plain text.
Reuse results in variables, calculate and filter inside the script, and return only what the answer needs. Do not fetch the same data again just to calculate. Parallelize independent reads with Promise.all or Promise.allSettled. Await writes sequentially, and never repeat a write after a script error without checking its state.
Transaction tools still require the user's intent and the existing confirmation rules. A script cannot approve a transaction or enable YOLO. Keep confirmation codes and previews intact in the returned text.
No imports, fetch, filesystem, timers, or access to credentials. No persistent variables between scripts. Each script has 24 tool calls, 120 seconds, and 24 KB of output. Deadlines stop scripts and new calls; already started calls settle before returning. A script error does not undo completed tool calls. Errors and completed calls are reported.
ask_user, load_skills, aero_liquidity and research submissions are direct tools, never available inside a script. After load_skills, wait for the next model step to use the newly loaded tools.
chain_metric JSON has current, prior, change, change_pct and daily rows [date, number|null]. chain_dexes JSON has total and rows with name, current, prior, change and changePct. Preserve nulls and include sources when summarizing data.
Available tool signatures:`;

/** All script capabilities originate in the same validated registrations as direct tools. */
export class PecuCodeMode {
  private readonly entries = new Map<string, Entry>();

  register<Input extends z.ZodType>(registration: Registration<Input>): void {
    if (!directTools.has(registration.name)) {
      this.entries.set(registration.name, {
        name: registration.name, description: registration.description,
        input: catalogSchema.parse(z.toJSONSchema(registration.input)),
        execute: async (input, context) => {
          const result = await registration.execute(registration.input.parse(input), context);
          if (result.output !== undefined) return JSON.stringify(jsonValueSchema.parse(result.output));
          return Array.isArray(result.content)
            ? result.content.flatMap(part => part.type === "text" ? [part.text] : []).join("\n")
            : z.string().catch("").parse(result.content);
        },
      });
    }
  }

  instructions(visible: (name: string) => boolean): string {
    const tools = Object.fromEntries([...this.entries.values()].filter(entry => visible(entry.name)).map(entry => [entry.name, Tool.make({
      description: entry.description, input: entry.input, output: Schema.String,
      execute: () => Effect.fail(new Error("Catalog only")),
    })]));
    return guidance + "\n" + CodeMode.make({ tools }).catalog().map(entry => `${entry.signature}\n${entry.description}`).join("\n\n");
  }

  async execute(code: string, context: ToolContext, visible: (name: string) => boolean): Promise<Result> {
    const calls: Call[] = [];
    const completed: { name: string; text: string; truncated?: boolean }[] = [];
    let progress = Promise.resolve();
    const publish = () => {
      const snapshot = calls.map(call => ({ ...call }));
      progress = progress.then(() => context.progress({ pecu_calls: snapshot }));
      return progress;
    };
    let accepting = true;
    const pending = new Set<Promise<string>>();
    const tools = Object.fromEntries([...this.entries.values()].filter(entry => visible(entry.name)).map(entry => [entry.name, Tool.make({
      description: entry.description, input: entry.input, output: Schema.String,
      execute: input => Effect.tryPromise(() => {
        const work = (async () => {
          if (!accepting || !visible(entry.name)) throw new Error("Tool is no longer available in this turn");
          const call: Call = { name: entry.name, status: "running", startedAt: Date.now() };
          calls.push(call);
          await publish();
          try {
            if (!accepting || !visible(entry.name)) throw new Error("Tool is no longer available in this turn");
            const text = await entry.execute(jsonValueSchema.parse(input), context);
            completed.push({ name: entry.name, text });
            call.outputBytes = new TextEncoder().encode(text).length;
            call.status = "complete";
            return text;
          } catch (error) {
            call.status = "error";
            throw error;
          } finally {
            call.endedAt = Date.now();
            await publish();
          }
        })();
        pending.add(work);
        void work.then(() => pending.delete(work), () => pending.delete(work));
        return work;
      }),
    })]));
    const runtime = CodeMode.make({ tools, limits: { timeoutMs: 120_000, maxToolCalls: 24, maxOutputBytes: 24_000 } });
    let result: CodeMode.Result;
    try {
      result = await Effect.runPromise(runtime.execute(code));
    } finally {
      accepting = false;
      // A deadline cannot undo an admitted host action. Settle it before returning control to the model.
      await Promise.allSettled(pending);
    }
    const recovered: typeof completed = [];
    if (!result.ok) {
      let remaining = Math.max(0, 24_000 - new TextEncoder().encode(JSON.stringify(result)).length - 1000);
      for (const output of completed.toReversed()) {
        const bytes = new TextEncoder().encode(JSON.stringify(output)).length;
        if (bytes <= remaining) { recovered.unshift(output); remaining -= bytes; }
        else if (remaining > 500) {
          const clipped = { ...output, text: output.text.slice(0, Math.floor((remaining - 500) / 6)), truncated: true };
          recovered.unshift(clipped);
          remaining = 0;
        }
      }
    }
    const content = JSON.stringify(result.ok ? result : { ...result, completed: recovered, recovery: "Completed calls are not rolled back. Check their state before retrying any write." });
    return { content, metadata: { pecu_calls: calls, pecu_code_error: !result.ok } };
  }
}
