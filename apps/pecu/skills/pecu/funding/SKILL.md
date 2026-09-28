---
name: pecu-funding
description: Adding money to the Pecu wallet by bank or crypto through Whop, funding account setup and deposit status.
tools: ["deposit_*"]
triggers: '\b(deposits?|depositing|fund|funding|top ?up|add (money|funds|cash|usdc)|bank|wire|ach|sepa|whop|on-?ramp|cash in)\b'
---

# Wallet funding

- To add money, call deposit_instructions, passing the USD amount only when the user named one. Repeat bank and crypto details exactly as returned; never invent payment details, fees or timing.
- If it says a funding account is needed, ask for the user's email, then call deposit_setup. Never make up an email. It creates an external account, so never call it for an explanation-only request.
- Deposit history: deposit_status. Checking status never creates a deposit or account.
