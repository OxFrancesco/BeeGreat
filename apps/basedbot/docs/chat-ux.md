# BasedBot chat UX

Normal replies show human token amounts and useful controls. Swap previews include expected output, minimum received, fee availability, and confirm/cancel commands. Wallet and balance replies omit repeated account metadata. Help omits framework names. Service JSON errors no longer spill into normal replies.

`b/verbose` or `/verbose` returns the latest stored technical result for the verified sender and conversation. `b/verbose 2` reads the next page. It does not rerun tools or enable JSON on future replies. Details survive SQLite and Durable Object restarts.

## Validation

TypeScript, 145 tests, and all four Worker dry-run builds passed. Tests cover exact dust amounts, human token balances, private verbose output, pagination, no additional transaction execution, and persistence in Workerd.

Existing production passed live wallet, balance, natural-language quote, and unsigned swap-preview checks. The test wallet received 0.002 ETH. An unsigned 0.000001 ETH to USDC preview was created. No transaction was confirmed or broadcast by this test.

## Remaining work

The new chat UX is not deployed. Automatic approval review rejected creating the production EVM dependency because deployment was not specifically authorized by the UX request. The bot's current production version remains unchanged.

After approval, configure the private EVM service with a Base RPC endpoint, deploy it and the updated bot, then verify normal replies and `b/verbose` in X. The swap preview does not include a complete smart-wallet network-fee estimate. Funded execution and receipt/balance verification remain pending.
