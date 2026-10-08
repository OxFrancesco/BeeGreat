import { abis } from "@beegreat/sugar";
import { decodeFunctionData, encodeFunctionResult, type AbiParameter } from "viem";
import { z } from "zod";

export type SugarRpcMode = "ok" | "quota";
type AbiSample = string | boolean | bigint | readonly AbiSample[];

const rpcRequestSchema = z.object({ id: z.number(), params: z.tuple([z.object({ data: z.templateLiteral(["0x", z.string()]) })]).rest(z.unknown()) });
const pageArgsSchema = z.tuple([z.unknown(), z.union([z.bigint(), z.number()])]).rest(z.unknown());

/** Smallest valid value for an ABI parameter, so encoded Sugar pages decode like real ones. */
function sample(param: AbiParameter, index: number): AbiSample {
  const { type } = param;
  if (type.endsWith("]")) return [];
  if (type === "tuple") return ("components" in param ? param.components : []).map(component => sample(component, index));
  if (type === "address") return `0x${(index + 1).toString(16).padStart(40, "0")}`;
  if (type === "bool") return false;
  if (type === "string") return `T${index}`;
  if (type === "bytes") return "0x";
  if (type.startsWith("bytes")) return `0x${"00".repeat(Number(type.slice(5)))}`;
  return BigInt(index + 1);
}

/** Local Base RPC that serves a tiny Sugar catalog or answers like an exhausted Chainstack quota. */
export function startSugarRpcMock(entries = 3) {
  let mode: SugarRpcMode = "ok";
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests++;
      const body = rpcRequestSchema.parse(await request.json());
      if (mode === "quota") {
        return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32005, message: "You've reached your monthly quota of Request Units (RUs)" } }, { status: 429 });
      }
      const { functionName, args } = decodeFunctionData({ abi: abis.sugar, data: body.params[0].data });
      const fn = abis.sugar.find(item => item.type === "function" && item.name === functionName);
      if (!fn || fn.type !== "function") throw new Error(`Unexpected Sugar call ${functionName}`);
      const page = pageArgsSchema.safeParse(args);
      const offset = page.success ? Number(page.data[1]) : 0;
      const outputs = functionName === "count"
        ? [BigInt(entries)]
        : fn.outputs.map(output => output.type.endsWith("[]") && offset === 0
          ? Array.from({ length: entries }, (_, index) => sample({ ...output, type: output.type.slice(0, -2) }, index))
          : sample(output, 0));
      // SAFETY: `fn` is the ABI entry for the decoded selector and `outputs` follows its output parameters.
      const result = encodeFunctionResult({ abi: [fn], functionName, result: outputs.length === 1 ? outputs[0] : outputs } as never);
      return Response.json({ jsonrpc: "2.0", id: body.id, result });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    get requests() { return requests; },
    setMode(next: SugarRpcMode) { mode = next; },
    stop() { server.stop(true); },
  };
}
