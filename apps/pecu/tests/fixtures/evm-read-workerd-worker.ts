import { evmReadClient, runEvmRead } from "../../src/cloudflare/evm-reads";

export default {
  async fetch() {
    const requests: string[] = [];
    globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const request = new Request(input, init);
      const body = await request.json() as { id: number; method: string };
      requests.push(body.method);
      return Response.json({ jsonrpc: "2.0", id: body.id, result: body.method === "eth_chainId" ? "0x2105" : body.method === "eth_blockNumber" ? "0x64" : "0x10" });
    }, { preconnect() {} });
    const client = evmReadClient("https://rpc.example");
    const result = await runEvmRead(client, { command: "balance", input: { chainId: 8453, address: "0x1111111111111111111111111111111111111111" } });
    return Response.json({ result, requests });
  },
};
