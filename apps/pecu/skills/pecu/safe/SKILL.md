---
name: pecu-safe
description: Organization Safe wallets, multisig proposals, approvals and execution, owners, spending budgets, restricted roles and passkey signers.
tools: ["safe_*"]
triggers: '\b(multisig|multi-sig|treasury|organi[sz]ation|quorum|threshold|co-?signers?|signers?|passkeys?|budgets?|roles?|modules?)\b|\bsafes?\s+(wallet|account|owners?|proposals?|transactions?|queue|threshold|signers?|modules?|address)\b|\b(a|my|our|new|create|deploy|open)\s+safe\b'
---

# Organization wallets

- Existing Safe: read safe_info and safe_queue before acting. Keep the returned transaction, nonce and signatures intact through approval and execution.
- safe_create creates one. safe_propose builds a transaction, safe_batch_propose makes atomic calls, safe_owner_propose and safe_cancel_propose change owners or cancel. Each needs the current owner threshold.
- safe_approve approves one exact hash and spends nothing. Recheck safe_approvals or the queue, and call safe_execute only when the threshold is met. When the queue returns executeWith, pass it unchanged to safe_execute_signatures.
- Budgets and roles: safe_budget_propose and safe_role_grant_propose need the owner quorum. Read the granted scope with safe_budget or safe_role_check before safe_budget_spend or safe_role_execute; these bypass the quorum only within that scope. Revoke with safe_budget_revoke_propose or safe_role_revoke_propose. A secondary Safe can hold a role without lowering the treasury threshold.
- Passkeys: safe_passkey_deploy and safe_passkey_owner_propose. Replacing a signer needs the surviving owner quorum.
- Safe values and budget amounts are integer base units, unlike evm_transfer. Read token decimals before converting. Never invent signatures, public keys, permission constraints or approval counts.
- Pecu relays through the confirmed Crossmint flow and keeps the personal wallet unchanged. Never claim independent custody for wallets controlled by the same backend. Describe destination, amount and contract action before asking for confirmation, and keep proposal JSON out of chat.
