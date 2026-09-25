# Commands and routing

## Sub-features

Every command and model tool from `bun apps/pecu/scripts/command-inventory.ts`; aliases, decimal flags, slippage, classifier reads, explanation-only turns, tool families and fallback providers.

## How to get to it (user POV)

Open `/agent` and select the intended thread, or use the existing authorized X conversation.

## Driving it with T3

Start with `/help`, `/wallet`, `/balance`, `/yolo`, `/aero positions`. Create one row per inventory entry and relevant option, not one row per family. Check contextual follow-ups and catalog expansion. Verify explanation-only replies cannot read account state or prepare actions. Exercise connected ChatGPT and configured OpenRouter fallback separately without disconnecting a user's active login as incidental setup.

## Gotchas

Classifier failure must retain inference, never infer execution. Nansen credit failures are not successful reads. A one-word synthetic probe measures overhead only.
