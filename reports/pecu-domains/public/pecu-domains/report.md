# Pecu domain migration

Deployed on 22 September 2026.

- Aero CLI and SDK: https://pecu.app/un-aerosdk
- EVM SDK: https://pecu.app/evmsdk
- Stocks: https://pecu.app/stocks
- Aero documentation: https://pecu.app/un-aerosdk/docs

The old Pecu `/aero/cli` and `/aero/stocks` paths redirect with HTTP 308, preserving suffixes, queries and request methods. The BuddyTools domains remain available for compatibility.

Both SDK pages reuse their existing Workers through the Pecu gateway. Their asset paths, links and canonical/social URLs resolve under Pecu. Stocks routes, API calls, sign-in return URLs and navigation use `/stocks`. The completed card work was preserved.

## Verification

Both production builds and TypeScript checks passed, as did five analytics tests. Live page and asset checks passed. Chrome rendered both SDK pages, including the Aero scene. Stocks restored the existing signed-in session and displayed holdings and saved history. The public market API returned HTTP 200. No transaction was requested or executed. Card claims and new sign-in flows were not exercised.

Some stock quotes were unavailable from the upstream market provider. Build output retains existing CSS import-order and chunk-size warnings.

## Deployment and scope

- Pecu gateway: `22e2779e-dae5-4fce-882e-763481fb9db8`
- Stocks: `61998f4a-8db9-4512-b96d-8fd5afab63ca`

Deployed in Francesco's personal Cloudflare account. Changes remain uncommitted in BeeGreat.

Web routes, deep links, API endpoints and static SDK sites apply. Bee mobile, Android, CLI commands, iMessage, voice, providers and transaction contracts are unchanged. Existing routes remain reachable through redirects. No SDK package code changed, so standalone SDK releases and on-chain verification do not apply. The agent Worker, Convex and Railway did not require deployment.
