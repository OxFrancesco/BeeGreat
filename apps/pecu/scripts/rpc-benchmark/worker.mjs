import { Predicate } from "effect";
import aeroWorker from '../../src/cloudflare/aero-worker.ts';

const token = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const expectedDecimals = `0x${'6'.padStart(64, '0')}`;
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const hex = (value) => `0x${value.toString(16)}`;
const canonical = (value) => JSON.stringify(value, (_, item) => Predicate.isRecord(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

async function benchmarkAero(providers) {
  const rows = [];
  const outputs = {};
  for (let i = -1; i < 10; i++) {
    for (const [provider, endpoint] of i % 2 === 0 ? Object.entries(providers) : Object.entries(providers).reverse()) {
      const started = performance.now();
      const response = await aeroWorker.fetch(new Request('https://aero.internal', { method: 'POST', body: JSON.stringify({ action: 'pools', parameters: { chain: 8453, limit: 5 } }) }), { ALCHEMY_RPC_URL: endpoint });
      const body = await response.json();
      const ms = performance.now() - started;
      const ok = response.ok && Array.isArray(body) && body.length === 5 && body.every(pool => /^0x[0-9a-fA-F]{40}$/.test(pool.lp));
      outputs[provider] = body;
      rows.push({ provider, operation: 'aero-pools', sample: i, warmup: i < 0, ms, ok, errors: ok ? [] : [{ status: response.status }] });
      await pause(500);
    }
  }
  return { operation: 'aero-pools', rows: rows.filter(row => !row.warmup), cold: rows.filter(row => row.warmup), consistent: canonical(outputs.alchemy) === canonical(outputs.chainstack) };
}

async function rpc(endpoint, method, params) {
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10_000), redirect: 'manual',
    });
    if (!response.ok) return { ms: performance.now() - started, status: response.status, ok: false, errorCode: 'http' };
    const body = await response.json();
    return { ms: performance.now() - started, status: response.status, ok: response.ok && !body.error && body.result !== undefined, result: body.result, errorCode: body.error?.code };
  } catch (error) { return { ms: performance.now() - started, ok: false, errorCode: 'transport', errorType: error?.name, detail: String(error?.message).replaceAll(endpoint, '[endpoint]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 180) }; }
}

export async function benchmark(providers, operation, samples = 10) {
  if (operation === 'aero-pools') return benchmarkAero(providers);
  const heads = await Promise.all(Object.values(providers).map(url => rpc(url, 'eth_blockNumber', [])));
  if (heads.some(head => !head.ok)) return { operation, rows: [], prerequisiteErrors: heads.map((head, index) => ({ provider: Object.keys(providers)[index], status: head.status, errorCode: head.errorCode, errorType: head.errorType, detail: head.detail, ok: head.ok })) };
  const block = Math.min(...heads.map(head => Number(BigInt(head.result)))) - 3;
  const call = [{ to: token, data: '0x313ce567' }, hex(block)];
  const cases = {
    block: ['eth_blockNumber', []],
    balance: ['eth_getBalance', [token, hex(block)]],
    contract: ['eth_call', call],
    logs: ['eth_getLogs', [{ address: token, fromBlock: hex(block - 4), toBlock: hex(block) }]],
    simulation: ['eth_simulateV1', [{ blockStateCalls: [{ calls: [{ to: token, data: '0x313ce567' }] }], traceTransfers: true, validation: false }, hex(block)]],
    concurrent: ['eth_call', call],
  };
  if (!(operation in cases)) throw new Error('Unknown benchmark operation');
  const [method, params] = cases[operation];
  const rows = [];
  const references = {};
  for (let i = -2; i < samples; i++) {
    const order = i % 2 === 0 ? Object.entries(providers) : Object.entries(providers).reverse();
    for (const [provider, endpoint] of order) {
      const started = performance.now();
      const replies = await Promise.all(Array.from({ length: operation === 'concurrent' ? 4 : 1 }, () => rpc(endpoint, method, params)));
      const ms = performance.now() - started;
      const ok = replies.every(reply => reply.ok &&
        ((operation === 'contract' || operation === 'concurrent') ? reply.result === expectedDecimals :
          operation === 'simulation' ? reply.result?.[0]?.calls?.[0]?.status === '0x1' && reply.result[0].calls[0].returnData === expectedDecimals : true));
      if (operation !== 'block') {
        const result = operation === 'simulation' ? replies[0].result?.[0]?.calls : replies[0].result;
        references[provider] = canonical(operation === 'logs' && Array.isArray(result) ? result.map(({ address, topics, data, blockHash, blockNumber, transactionHash, transactionIndex, logIndex, removed }) => ({ address, topics, data, blockHash, blockNumber, transactionHash, transactionIndex, logIndex, removed })) : result);
      }
      if (i >= 0) rows.push({ provider, operation, sample: i, ms, ok, errors: replies.filter(reply => !reply.ok).map(reply => ({ status: reply.status, code: reply.errorCode })) });
      await pause(Math.max(0, (operation === 'concurrent' ? 500 : 125) - ms));
    }
  }
  return { startedAt: new Date().toISOString(), operation, block, heads: heads.map(head => head.result), consistent: operation === 'block' ? null : new Set(Object.values(references)).size === 1, rows };
}

export default {
  async fetch(request, env) {
    if (!env.BENCHMARK_TOKEN || request.headers.get('authorization') !== `Bearer ${env.BENCHMARK_TOKEN}`) return new Response(null, { status: 404 });
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    try {
      const { providers, operation } = await request.json();
      if (operation === 'production-pools' && env.AERO) {
        const started = performance.now();
        const response = await env.AERO.fetch(new Request('https://aero.internal', { method: 'POST', body: JSON.stringify({ action: 'pools', parameters: { chain: 8453, limit: 5 } }) }));
        const body = await response.json();
        return Response.json({ operation, status: response.status, ms: performance.now() - started, ok: response.ok && Array.isArray(body) && body.length === 5, poolAddresses: Array.isArray(body) ? body.map(pool => pool.lp) : [] });
      }
      if (Object.keys(providers).sort().join() !== 'alchemy,chainstack') return new Response(null, { status: 400 });
      for (const [name, endpoint] of Object.entries(providers)) {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' || url.hostname !== (name === 'alchemy' ? 'base-mainnet.g.alchemy.com' : 'base-mainnet.core.chainstack.com')) return new Response(null, { status: 400 });
      }
      const result = await benchmark(providers, operation);
      return Response.json({ runtime: 'cloudflare-worker', colo: request.cf?.colo, ...result });
    } catch { return Response.json({ error: 'Benchmark failed' }, { status: 502 }); }
  },
};
