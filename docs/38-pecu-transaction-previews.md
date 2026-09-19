# Pecu transaction previews

Pecu uses the selected amount-led clay design for transaction previews. Amber-minimal
colors, Inter and JetBrains Mono remain shared with the rest of the product.

Known swap, transfer, approval, revoke and Aave summaries promote their amounts.
Baskets retain per-trade minimums. Other actions retain every original field and
warning in a quieter detail layout. Full addresses wrap and copy without shortening.
No quote, fee or extra execution stage is synthesized by the presentation layer.

The web component still sends `/confirm CODE` and `/cancel CODE` through the existing
chat path. Submitted transactions can be checked, not cancelled. Terminal states
cannot submit. The confirmation code is available in a disclosure. Exact decimal
strings are preserved without numeric conversion.

Container queries stack actions and metadata below 380px of card content width.
The mobile conversation places the mascot above transaction cards. Buttons stay at
least 48px tall and scrollbars remain hidden without disabling scrolling.

The static `/design` page renders the real component with fictional fixtures during
its build. The isolated interactive fixture supports 13 examples and six states.
It never connects to a wallet or backend.

## Scope

This changes Pecu's shared web transaction component and design reference. Both the
Agent conversation and Stocks chat use that component. X chat stays plain text;
backend contracts, provider routing, confirmation rules and execution are unchanged.
BeeGreat mobile, Android, CLI and iMessage do not mount Pecu's web preview component.

## Verification

Parser and component tests cover exact amounts, per-trade minimums, full addresses,
unknown fields and warnings, command binding, busy controls and terminal states.
Browser checks cover 13 examples at 320, 390, 768 and 1440 CSS pixels, with no page
or card overflow and no undersized transaction actions. Tests use fictional data;
no quote was requested and no funds moved.

Product deployment remains a separate step from the reviewed GitHub release.
The design reference renders all six real component states and changes specimens
locally; regression tests cover submitted controls and terminal-state content.
