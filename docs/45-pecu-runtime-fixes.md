# Pecu runtime fixes, 25 September 2026

Pecu's simple Base reads run directly in the EVM Worker through viem. Balance, token and allowance reads validate chain 8453 and use one fresh block. Known Base token metadata comes from the token catalog. Other EVM commands still use the isolated planning container, now `basic` instead of `lite`.

The HTTP transport uses manual redirects because Cloudflare's runtime does not support the `error` mode. A Workerd regression test exercises the real viem HTTP transport. Provider errors do not expose RPC URLs or credentials.

## Inference and delivery

- Disable the bundled model catalog and register only Pecu's configured models. A request hook preserves the authenticated ChatGPT account header independently of that catalog. OpenRouter requests never receive it.
- Select a small, stable tool family in the existing classifier request. Ambiguous classifications retain the full catalog; `enable_all_tools` can expand a restricted family without granting transaction permission.
- Fetch only the latest assistant message when extracting a reply. Process analytics in `waitUntil`, using the session log cursor. The next turn waits for the previous cursor to finish to preserve attribution.
- Start inference warmup while classification runs. Keep transaction recovery in blocking initialization; move deposit relay and X setup to background initialization.
- Pass streamed paragraphs through the Worker RPC bridge and send SSE keep-alives while tools run. Preserve failed input and its request ID so retry does not create a different request.

## Previews

Liquidity deposits show both paired token amounts. Aave accepts the API's `approval` response and the older `byTransaction` form. It verifies the token, spender and required amount, limits approval to the required amount, and displays that limit separately from the eventual supply or repayment. Nested API warnings reach the preview. Account and reserve inspection run together; simulation and preparation wait for both.

## Verification

The backend suite passed 462 tests. Backend and web type checks, four Worker builds, the web build and the focused thread/retry tests passed. The broader web suite retains one unrelated Nansen P&L navigation failure; Nansen is excluded from this task.

Production checks used the existing authenticated thread and wallet. They verified allowance reads, swap/send/approval/revoke previews, paired liquidity amounts, Safe creation preview, Aave approval preview, cancellation, Polymarket data and explanation turns. Previews were cancelled. No transaction was signed or submitted, so execution, receipt verification and full transaction lifecycles remain unverified.

Repeated allowance requests completed in about 0.5 seconds, replacing the observed 90-second failures. One USDC send preview completed in 8.6 seconds and one approval preview in 10.4 seconds, compared with roughly two minutes in the earlier run. These are small samples. The earlier production p50 of 18.1 seconds and p95 of 43 seconds are not directly comparable to this selected regression set.

Local Workerd heap probes with the full catalog disabled peaked around 123–127 MB for the full-tool one-word probe, compared with up to 143 MB before. Five wallet-family probes peaked at 133.5 MB. They are isolated local measurements, not proof of production memory headroom. Previously failing production model requests now completed without memory resets in this run.

## Remaining performance work

1. Keep one planning process alive inside the EVM container. The current per-command Bun startup still costs time; direct reads avoid it, but send/approve/Safe preparation still incurs it. Preserve isolated request journals and per-wallet execution locks.
2. Give common Aave workflows a typed preparation entry point that includes workflow/schema guidance without extra model lookup rounds. Keep fresh discovery, inspection, simulation and separate approvals. This can remove model round trips without caching financial state.
3. Measure CPU and queueing before moving public-market formatting into a separate Worker. Observed main-object CPU was tens of milliseconds for turns taking seconds. Upstream and model waits dominate these samples; a shared-object rewrite is not yet justified by them.
4. If long threads still approach the memory ceiling, replace the heavyweight embedded inference runtime with a small provider loop or move it to a dedicated container. Keep conversation state, confirmation rules and transaction recovery in Durable Objects. Never trim transaction state to save prompt memory.

## Coverage and maintenance

These changes apply to Pecu web and X through their shared backend. Web retry rendering applies to both the agent route and embedded Stocks chat. X delivery was covered by automated fixtures, not a live X Chat run. Both provider paths have routing tests; production ChatGPT status was rechecked after restoring its account header. BeeGreat mobile, Android, CLI and iMessage use separate runtimes and are unchanged. No SDK package changed, so standalone SDK publication does not apply.

`.cursor/skills/verify-pecu/SKILL.md` documents production launch, wallet/YOLO checks, the feature map, evidence and cleanup. Its comparator treats previously passing rows that fail, become blocked or disappear as regressions. No completed prior full-run matrix was available; this run cannot claim complete row-by-row regression coverage. Use `/maintain-verification-skill` when the command surface changes.
