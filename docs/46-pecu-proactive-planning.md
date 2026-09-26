# Pecu proactive planning

Pecu reads balances and matching pools before asking about liquidity. It asks for
only the pool or pair and the total budget if those are missing, suggesting an
affordable choice. Once those are known, `aero_liquidity` prepares the full plan.
"Use half my ETH" means half the current ETH balance for the funding swap and
position together. It does not create a separate wrapping proposal.

## Budget planning

The typed tool accepts an existing concentrated-liquidity pool, or a pair with
verified token order and supported tick spacing. A new uninitialized pool also
needs an initial market price established by the agent's read tools. These
technical values are not a questionnaire for the user. Existing-pool creation
means a new position and is described as such.

The planner reads fresh balances and pool data, defaults to a range 20% below and
above spot, and calculates the split using the SDK's deposit estimates and swap
quotes. Deposit inputs cannot exceed the remaining funding budget or the swap's
minimum output. ETH follows the SDK's native deposit path, wrapping inside the
mint call. Unused tokens remain in the wallet. Full native-balance spending is
rejected to leave ETH for fees; network fees are not estimated by this planner.

Funding must be one of the pool tokens, including ETH for WETH. The current tool
supports two-sided concentrated liquidity. A dollar budget needs USDC or conversion
to a held token using a live quote. The range is adjustable, not an optimal-return
claim. Fees stop outside it and token exposure changes.

## Confirmation and recovery

The funding swap, approvals and mint form one persisted `liquidity_budget` intent.
Each swap/deposit group retains the existing transaction validation. The combined
calls share a digest, expiry and confirmation. Crossmint receives one ordered
multi-call request with no approval during preparation. After confirmation, the
first journal step stores the provider transaction ID for the entire batch.
Remaining steps succeed only after the matching UserOperation receipt succeeds.
Retries and boot recovery reuse that transaction ID; there is no sequential fallback.

YOLO still requires the user's explicit setting. With YOLO off, the one combined
preview needs confirmation. Linked external wallets are explicitly unsupported
for this tool and are never silently replaced by the Pecu wallet. Their existing
individual-transaction flow remains separate.

## Scope and verification

Pecu Agent, Stocks chat and X Chat share the tool and prompt on ChatGPT and
OpenRouter. Web renders the exact decoded calls; X gets the text transaction list.
CLI commands retain their existing syntax. BeeGreat mobile, Android, CLI,
iMessage, voice and Hive do not run this Pecu agent. No SDK package changed.
The Aero service worker and main worker must ship together, Aero first.

Regression tests cover total budgets, native token handling, token order, input
validation, one provider batch, confirmation, pending receipt retries and recovery.
They use fixture RPC/provider data and move no funds. Live model quality and a real
on-chain funding batch are separate from these checks and remain unverified.

Contract addresses in preview details, transaction steps and profile address lines
are shortened like the wallet chip. Hover or keyboard focus reveals the full
address; touch users can focus it. Copy controls keep the exact address.
