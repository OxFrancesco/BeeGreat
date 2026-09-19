# Responsive transaction previews

Pecu now uses the selected amount-led clay card, with amber-minimal colors and
typography. Baskets keep each trade with its minimum received amount. Approval
cards separate the spending permission from the follow-up action.

[Try the interactive preview](./live/transactions)

The preview uses fictional data and the actual React component. Its controls only
change local state. No quote was requested, no wallet was connected and no funds moved.

## Checked

- 13 transaction examples at 320, 390, 768 and 1440 CSS pixels. All 52 combinations
  fit without horizontal page/card overflow, with transaction actions at least 44px tall.
- Full addresses and long decimal amounts, per-trade minimums, and unknown fields.
- Pending, submitted, completed, failed, cancelled and expired states. Submitted
  transactions offer Check transaction, without Cancel. Busy controls disable submission.
- The actual Agent conversation at 320px, address copy feedback and reduced motion.
- 19 focused tests, both frontend builds and typechecks, design lint and theme drift checks.

`/design` now renders the real React component during its build. Its sample controls
remain local. The backend contract, execution and confirmation rules are unchanged.
X chat retains its text presentation. BeeGreat native, CLI and iMessage clients do
not use this Pecu web component. Stocks chat and Pecu Agent share it.

Product deployment remains pending. Changes are uncommitted on main; unrelated
analytics work was preserved. This report and interactive fixture are isolated.
Existing build warnings concern font import order and bundle size.

[Watch browser interaction highlights](./verification.mp4)

The recording contains actual browser frames with idle gaps shortened.

![Desktop preview](./desktop.png)

![Mobile preview](./mobile.png)

![Basket preview](./basket.png)

![Approval preview](./approval.png)

![Mobile Agent conversation](./chat-mobile.png)
