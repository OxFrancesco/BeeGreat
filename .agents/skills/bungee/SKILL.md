---
name: Bungee
description: Use when building token swap and cross-chain bridging integrations, quoting routes across chains and DEXes, executing transactions, monitoring transaction status, or implementing deposit flows from non-EVM networks. Agents should reach for Socket when users need to move tokens across blockchains, when building wallet or exchange integrations, or when implementing multi-chain liquidity routing.
metadata:
    mintlify-proj: bungee
    version: "1.0"
---

# Socket Skill

## Product Summary

Socket is a unified routing engine for token swaps and cross-chain bridging. It abstracts away the complexity of routing across 50+ chains, 10,000+ assets, multiple liquidity sources (DEXes, bridges, solvers), and payment rails. Agents use Socket to quote routes, execute transactions, track status, and create deposit addresses for multi-chain asset movement.

**Key entry points:**
- **Socket Swap V3 API**: `/v3/swap/quote` (get routes), `/v3/swap/status` (poll execution), `/v3/swap/supported-chains`, `/v3/swap/tokens/list`, `/v3/swap/tokens/search`
- **Socket Widget**: React component for drop-in swap/bridge UI (`@socket.tech/widget`)
- **Deposit Addresses**: Accept deposits from any chain without requiring user signatures
- **Base URLs**: `https://public-backend.socket.tech` (testing, no auth), `https://backend.socket.tech` (domain-whitelisted), `https://dedicated-backend.socket.tech` (API key, production)
- **Primary docs**: https://docs.socket.tech

## When to Use

Reach for Socket when:
- **Quoting routes**: User wants to swap or bridge tokens; fetch quotes from `/v3/swap/quote` with `userOps=tx`
- **Executing swaps**: User has selected a route; submit `txData.object` directly on-chain (no separate submit endpoint)
- **Tracking transactions**: Poll `/v3/swap/status` with `quoteId` to monitor completion
- **Deposit flows**: User needs to send funds from a wallet, exchange, or non-EVM chain without signing in the same flow; use `userOps=deposit`
- **Multi-chain support**: Integrating EVM, Solana, Tron, or Stellar; Socket handles all chain-specific logic
- **Fee monetization**: Charging integrator fees on swaps; pass `feeBps` and `feeTakerAddress` in quote request
- **Widget integration**: Need a fast path to production with pre-built swap/bridge UI

Do not use Socket for: wallet management, token price feeds (use Socket only for routing), or non-blockchain operations.

## Quick Reference

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/v3/swap/quote` | GET | Fetch executable routes for swaps/bridges | Optional (API key for production) |
| `/v3/swap/status` | GET | Poll transaction status by `quoteId` | Optional |
| `/v3/swap/supported-chains` | GET | List supported chains | None |
| `/v3/swap/tokens/list` | GET | List tokens by chain | None |
| `/v3/swap/tokens/search` | GET | Search tokens by address/name/symbol | None |

### Quote Request Parameters (Essential)

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `userOps` | string | Yes | `tx` for direct routes, `deposit` for deposit flows, `cex-withdraw` for CEX withdrawals |
| `originChainId` | string | Yes (for `tx`/`deposit`) | Source chain ID |
| `destinationChainId` | string | Yes | Destination chain ID |
| `inputToken` | string | Yes | Source token address; use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native |
| `inputAmount` | string | Yes | Amount in smallest token unit |
| `outputToken` | string | Yes | Destination token address |
| `receiverAddress` | string | Yes | Destination wallet address |
| `userAddress` | string | Yes (for `tx`) | Source wallet that will sign the transaction |
| `slippage` | number string | No | Slippage percent (e.g., `0.5` for 0.5%) |
| `feeBps` | number string | No | Integrator fee in basis points; requires `feeTakerAddress` |
| `feeTakerAddress` | string | No | Fee recipient; required when `feeBps` is set |
| `contractCaller` | string | No | Intermediate contract address if routing through a contract instead of user wallet |

### Quote Response Structure

```json
{
  "success": true,
  "result": {
    "routes": [
      {
        "quoteId": "0x...",
        "expiresAt": 1760000000,
        "output": { "amount": "9855420", "minAmountOut": "9806142" },
        "approval": { "spenderAddress": "0x...", "amount": "10000000" },
        "txData": { "kind": "evm_tx", "object": { "to": "0x...", "data": "0x...", "value": "0" } },
        "routeTags": ["SUGGESTED", "MAX_OUTPUT"],
        "statusCheck": { "endpoint": "...", "intervalSec": 5 }
      }
    ]
  }
}
```

### Status Response Values

| Status | Meaning |
|--------|---------|
| `PENDING` | Quote not yet started |
| `IN_PROGRESS` | Source transaction confirmed; destination still pending |
| `COMPLETED` | Route complete |
| `FAILED` | Route failed |
| `EXPIRED` | Quote or execution window expired |
| `REFUNDED` | Funds refunded |

### Common Provider IDs

**Same-chain DEX**: `zeroxv2`, `openocean`, `kyberswap`, `magpie`, `bebopPmm`

**Cross-chain bridges**: `across`, `arbitrum-native`, `celer`, `cctp-v2`, `oft`, `relay`, `polygon-native`

## Decision Guidance

| Scenario | Use | Why |
|----------|-----|-----|
| User wants to swap on same chain | `/v3/swap/quote` with `originChainId === destinationChainId` | Simpler routing, lower fees |
| User wants to bridge across chains | `/v3/swap/quote` with `originChainId !== destinationChainId` | Socket handles bridge selection and execution |
| User has no wallet connected | Deposit addresses (`userOps=deposit`) | User sends funds directly; no signature required |
| Need fast UI integration | Socket Widget (`@socket.tech/widget`) | Pre-built React component; handles all flows |
| Need full control over UX | Socket API directly | Build custom UI; more control, more work |
| User is on non-EVM chain | Deposit addresses or Widget with Solana/Tron/Stellar support | Socket handles chain-specific signing and submission |
| Want to charge fees | Add `feeBps` + `feeTakerAddress` to quote request | Fees deducted from output; client-facing amount already net of fees |
| Migrating from Bungee API | Use `/v3/swap/quote` with `userOps=tx` | Simpler flow: no `submit` endpoint, no EIP-712 signing |

## Workflow

### Standard Swap/Bridge Flow

1. **Get a quote**: Call `/v3/swap/quote` with required parameters (`userOps=tx`, chain IDs, token addresses, amounts, user address).
   - Check `expiresAt` — discard expired quotes.
   - Select a route by `routeTags` (prefer `SUGGESTED`) or compare `output.valueInUsd`, `estimatedTime`, `gasFee`.

2. **Check approval**: If `route.approval` is present, approve `approval.spenderAddress` for `approval.amount` of `approval.tokenAddress` before submitting the transaction.

3. **Submit transaction**: Send `route.txData.object` as a transaction from `userAddress` using your wallet client (viem, ethers, etc.).
   - Do not rebuild calldata client-side; use `txData.object` exactly as returned.

4. **Poll status**: Call `/v3/swap/status?quoteId=<quoteId>` every 5 seconds (or per `statusCheck.intervalSec`).
   - Poll until status reaches a terminal state (`COMPLETED`, `FAILED`, `EXPIRED`, `REFUNDED`).

### Deposit Address Flow

1. **Get a deposit quote**: Call `/v3/swap/quote` with `userOps=deposit`, `refundAddress`, and optional `userAddress`.
   - Response includes `result.deposit.txData` and `result.deposit.requestHash`.

2. **Submit or display**: Either submit `deposit.txData` programmatically, or display `deposit.depositData` (recipient, token, amount, chain) for manual user submission via QR code.

3. **Poll status**: Call `/v3/swap/status?quoteId=<requestHash>` (note: use `requestHash` as the identifier for deposit flows).

### Widget Integration

1. **Install**: `pnpm install @socket.tech/widget react react-dom viem @tanstack/react-query`
2. **Mount QueryClientProvider** above your app.
3. **Import styles**: `import "@socket.tech/widget/styles.css"` and `fonts.css`.
4. **Provide wallet adapter**: Pass `config.wallet` with `accounts`, `getEVMWalletClient`, and optionally `getSolanaSigner`, `getTronWeb`, `switchChain`.
5. **Render**: `<SocketWidget config={config} />`

## Common Gotchas

- **Missing `userOps` parameter**: `/v3/swap/quote` requires `userOps=tx` (or `deposit`/`cex-withdraw`). Omitting it returns a 400 error.
- **Expired quotes**: Always check `expiresAt` before submitting. Expired quotes will fail on-chain.
- **Not approving before submit**: If `route.approval` is present, you must approve the spender before sending the transaction. Skipping this causes the transaction to revert.
- **Rebuilding calldata**: Never rebuild `txData` client-side. Use the returned object exactly as provided; any modification breaks the transaction.
- **Wrong `contractCaller`**: If your integration routes through an intermediate contract, set `contractCaller` to that contract's address. Without it, AllowanceHolder reverts with `CallerNotSignedUser`.
- **Native token address**: Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native tokens (ETH, MATIC, etc.), not `0x0`.
- **Identical input/output tokens**: Same-chain quotes reject identical `inputToken` and `outputToken`. This is by design.
- **Solana/Tron/Stellar support**: Deposit addresses work on these chains, but direct transaction routes (`userOps=tx`) are EVM-only. Use deposit addresses for non-EVM sources.
- **API key exposure**: Keep `x-api-key` server-side. Never expose it in frontend code or client bundles.
- **Rate limits**: Public endpoint is shared; dedicated endpoint has 20 rps (100 rps for enterprise). Plan accordingly.
- **Migrating from Bungee**: The old API required a `submit` endpoint and EIP-712 signing. Socket V3 removes both — just send `txData.object` directly.

## Verification Checklist

Before submitting work with Socket:

- [ ] Quote request includes all required parameters (`userOps`, chain IDs, token addresses, amounts, user address).
- [ ] Quote response is checked for `success: true` and non-empty `routes[]`.
- [ ] Selected route's `expiresAt` is in the future.
- [ ] If `route.approval` is present, approval transaction is submitted and confirmed before the main transaction.
- [ ] `txData.object` is submitted exactly as returned (no client-side modifications).
- [ ] Status polling uses the correct `quoteId` (or `requestHash` for deposit flows).
- [ ] Status polling continues until a terminal state is reached.
- [ ] Error responses are logged with `server-req-id` header for debugging.
- [ ] For deposit flows, `refundAddress` is set and matches the user's wallet.
- [ ] For fee-charging integrations, both `feeBps` and `feeTakerAddress` are provided together.
- [ ] For contract-routed transactions, `contractCaller` is set to the intermediate contract address.
- [ ] API credentials (API key, affiliate ID) are stored securely and not exposed in client code.

## Resources

**Comprehensive navigation**: https://docs.socket.tech/llms.txt — page-by-page listing of all documentation.

**Critical pages**:
1. [Socket Swap V3 API Guide](https://docs.socket.tech/integrate/integration-guides/socket-api) — full integration walkthrough with examples
2. [Get API Access](https://docs.socket.tech/integrate/get-api-access) — endpoint selection and authentication
3. [Deposit Addresses Guide](https://docs.socket.tech/integrate/integration-guides/deposit-addresses) — multi-chain deposit flows

**For agents**: https://docs.socket.tech/for-agents/intro — agent-specific guidance and machine-readable resources (skill.md, llms.txt, llms-full.txt).

**Migration**: If updating from Bungee API, see [Bungee v1 → Socket v3 Migration Guide](https://docs.socket.tech/integrate/migration-guide).

---

> For additional documentation and navigation, see: https://docs.socket.tech/llms.txt