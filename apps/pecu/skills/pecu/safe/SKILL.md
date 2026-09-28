---
name: pecu-safe
description: Organization Safe wallets, multisig proposals, approvals and execution, owners, spending budgets, restricted roles and passkey signers.
tools: ["safe_*"]
triggers: '\b(multisig|multi-sig|treasury|organi[sz]ations?|quorum|threshold|co-?signers?|co-?owners?|signers?|passkeys?|budgets?|roles?|modules?|safes)\b|\b(shared|team|joint|group|company|dao|family)\s+(wallets?|accounts?|treasury)\b|\b\d+\s*(?:of|-of-|/)\s*\d+\s+(?:wallet|safe|multisig)|\bsafes?\s+(wallet|account|owners?|proposals?|transactions?|queue|threshold|signers?|modules?|address|app)\b|\b(a|my|our|the|this|that|new|create|creating|deploy|open|your)\s+safe\b(?!\s+(to|bet|option|choice|way|side|place|enough|and\s+sound))'
---

# Organization wallets

- The user's Safes: call safe_list before asking for an address. It covers Safes created with Pecu in any chat and those added on the profile, with names and whether each is ready, still being created or was never created.
- Existing Safe: read safe_info and safe_queue before acting. Keep the returned transaction, nonce and signatures intact through approval and execution.
- safe_create creates one from explicit owner addresses and a threshold. The user's Pecu wallet is usually one owner; read it with wallet_address rather than asking. Ask for the other owners' addresses and the required approvals, and never invent or reuse an owner. The new Safe shows up in safe_list and on the profile under My Safes.
- safe_propose builds a transaction, safe_batch_propose makes atomic calls, safe_owner_propose and safe_cancel_propose change owners or cancel. Each needs the current owner threshold.
- safe_approve approves one exact hash and spends nothing. Recheck safe_approvals or the queue, and call safe_execute only when the threshold is met. When the queue returns executeWith, pass it unchanged to safe_execute_signatures.
- Budgets and roles: safe_budget_propose and safe_role_grant_propose need the owner quorum. Read the granted scope with safe_budget or safe_role_check before safe_budget_spend or safe_role_execute; these bypass the quorum only within that scope. Revoke with safe_budget_revoke_propose or safe_role_revoke_propose. A secondary Safe can hold a role without lowering the treasury threshold.
- Passkeys: safe_passkey_deploy and safe_passkey_owner_propose. Replacing a signer needs the surviving owner quorum.
- Safe values and budget amounts are integer base units, unlike evm_transfer. Read token decimals before converting. Never invent signatures, public keys, permission constraints or approval counts.
- Pecu relays through the confirmed Crossmint flow and keeps the personal wallet unchanged. Never claim independent custody for wallets controlled by the same backend. Describe destination, amount and contract action before asking for confirmation, and keep proposal JSON out of chat.
