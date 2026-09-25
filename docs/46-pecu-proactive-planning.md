# Pecu proactive planning

For underspecified wallet actions, Pecu reads relevant balances and protocol data
before recommending a concrete plan. It states the proposed allocation and leaves
funds available. Explicit user amounts and settings take precedence.

Aerodrome liquidity recommendations include amounts, a pool and, for concentrated
liquidity, a price range with its tradeoff. Pecu distinguishes creating a pool from
adding a position to an existing one. Pool listings provide tick spacing and token
order but omit spot prices, so the DeFi tool family also exposes `evm_inspect` and
`evm_read`. A swap quote supplies a reference price, not the selected pool's spot.

The full recommendation goes into `ask_user.question`, because the stored question
replaces the final model reply. Options let the user accept, adjust or cancel. The
agent must wait for acceptance before preparing suggested parameters, even with
YOLO enabled. It rechecks balances and conditions after acceptance. The existing
confirmation and execution flow then applies. These are model instructions; this
change does not add a deterministic recommendation-acceptance gate.

## Scope

The shared OpenCode prompt covers Pecu Agent, Stocks chat and X Chat on both the
ChatGPT and OpenRouter paths. Web retains its question buttons; X uses plain text.
The DeFi catalog change also applies when the classifier selects the smaller model.
Explicit CLI commands retain their current behavior. BeeGreat mobile, Android,
CLI, iMessage, voice and Hive do not run this Pecu prompt. No SDK, wire contract,
transaction policy or provider configuration changes are required.

## Verification

All 467 tests passed across the main suite and an isolated rerun of the five
Workerd tests, which need local port access outside the sandbox. After the final
catalog change, the nine routing, question and tool tests passed again. Type
checking, lint, docs generation and all four Worker dry-run builds passed.
The model-routing fixture checks that the DeFi catalog includes contract inspection
and reads. Existing question and confirmation tests cover question persistence,
cancellation and transaction confirmation boundaries.

Live model evaluation with fictional wallet data requires approval to send the
internal prompt and tool definitions to OpenRouter. Automatic approval review
rejected that provider request. No wallet transaction was attempted. Live recommendation quality remains unverified. Build and deployment checks do
not establish how the model answers a real wallet request.
