# Pecu portfolio

Deployed to pecu.app on September 25, 2026 from commit 8181bd34.

- ETH and USDC balances appear above P&L in the Agent wallet panel.
- The + beside Balances opens token entry. The input stays hidden otherwise.
- Add Base tokens by supported ticker or contract address. Remove hides custom tokens. The list is saved per wallet in this browser.
- Stock positions switch between List and Graph. Graph shows current allocation by estimated USDC value.
- Profile and Agent share the balance and stock components. Chat stock cards use the same toggle.

## Verification

468 backend tests and 70 frontend tests pass. Both TypeScript checks, the Stocks production build, the Worker dry-run build, design checks, and diff secret scan pass. The site documentation build passes.

Browser checks used synthetic balances. Verified the plus popover, ticker addition, duplicate rejection, saved tokens after reload, the stock graph, and the 390px layout. The mobile frame has no horizontal overflow and the popover fits inside it. The recording contains fixture verification and development reloads.

The authenticated read endpoint selects the sender's stored wallet. It does not provision wallets, create chat turns or transaction plans, or sign. No funds moved.

## Release

After explicit release approval, the Pecu Worker, Stocks web app and documentation were deployed in order. Signed-in production verification passed for ETH and USDC balances, the stock list and graph, AERO ticker addition, WETH contract-address addition, and removal of both test entries. No funds moved. Public screenshots and the linked recording remain synthetic fixtures; the live recording was sent privately.

The UI applies to desktop and mobile browsers. Other BeeGreat clients have no profile changes; X Chat keeps its text commands. Both inference providers share the read endpoint.
