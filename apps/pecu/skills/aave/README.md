# Aave workflows

Official skills from https://github.com/aave/skills at commit `b21a0345f47f5fb8337d6769f927b7b56ff3943a`, retrieved September 14, 2026. The upstream license is included in LICENSE.

The bot exposes all five workflow texts through `aave_skill`. Bundled text is in `src/integrations/aave-skills.json`. Tool schemas in `src/integrations/aave-tools.json` come from the official https://mcp.aave.com `tools/list` response.

Pecu supports reads, previews, and Base v3 supply, borrow, withdraw, and repay plans. The bot binds signing to the verified user's wallet and uses its persisted confirmation or per-chat YOLO execution path. Approval-only results require a new request for the subsequent action. Other transaction builders and signed orders are not enabled.
