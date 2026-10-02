---
title: MCP
description: Connect an MCP client to your existing Pecu account and tools.
group: Integrations
---

## Connect

Add a remote MCP server in your client with this URL:

```text
https://pecu.app/mcp
```

Choose OAuth login and sign in with the account you already use in Pecu.
Clerk asks which permissions you allow. Read access uses `pecu:read`.
Tools that prepare transactions, create research or edit automations also use
`pecu:write`. A read connection receives a permission error when it tries
one of those tools.

### Codex

Add Pecu and sign in:

```sh
codex mcp add pecu --url https://pecu.app/mcp --oauth-client-registration cimd
codex mcp login pecu --oauth-client-registration cimd
```

Pecu uses Codex's client metadata document for registration. If your connection
needs a pre-registered client, add `--oauth-client-id YOUR_CLERK_CLIENT_ID` and
register the exact callback Codex displays. See the
[Codex OAuth guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#oauth-client-registration).

The add command can start login immediately. To request action permissions
and refresh access, sign in again and approve the requested scopes in Clerk:

```sh
codex mcp login pecu --oauth-client-registration cimd --scopes pecu:read,pecu:write,offline_access
```

On 2026-10-02, Codex completed Google sign-in and consent for both Pecu
permissions, discovered all 190 tools and read the wallet address from the
same Pecu backend. This verified login and read access. No live write operation
or financial transaction was tested.

The server supports MCP `2026-07-28` and older Streamable HTTP clients.
Every request carries its own authentication. No session connection is needed
between calls.

## Tools

The MCP catalog shares Pecu's chat tools for wallets, Aerodrome, tokenized
stocks, EVM contracts, Safe organizations, Aave, funding, Nansen, Polymarket,
X data, chain data, automations and research. Each tool includes its exact
argument schema.

`run_tools` calls several tools from one JavaScript script. It checks your
permission for each call. `load_skills` returns Pecu's instructions for the
requested task. The two submission tools used by Pecu's private research
agents are not client tools.

## Review transactions

Transaction tools create a preview in a Pecu thread for the connected client.
Open [Pecu](/agent), select that thread, and review the amount, recipient,
network and transaction steps. Confirm or cancel the specific preview there.
MCP cannot submit the transaction, enable YOLO or approve an automation's
spending allowance.

See [Confirmations](/docs/pecu/confirmations) for expiry and recovery rules.

## Retry a call

A client can send a UUID in the `Idempotency-Key` HTTP header. Repeating the
same key and arguments returns the saved result. Use a new key for a new
request. Reusing a key with different arguments fails.

## Disconnect

For Codex, remove the locally stored login:

```sh
codex mcp logout pecu
```

Revoke the client's OAuth connection in your Clerk account. The next request
checks that revocation. Disconnecting does not undo completed work. Pending
transaction previews retain their normal cancellation and expiry rules.
