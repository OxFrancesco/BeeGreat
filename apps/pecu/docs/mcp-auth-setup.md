# MCP account connection

Pecu's MCP endpoint uses the same Clerk instance and backend as the web app. A verified X account resolves to its existing Pecu sender and wallet. Other sign-in methods resolve to `web-<Clerk user id>`. The MCP client cannot choose an owner or sender.

The resource identifier is `https://pecu.app/mcp`. Clients must send that exact value as `resource` in both the authorization and token requests. Pecu rejects tokens with missing or different audiences, revoked tokens, expired tokens, and browser session tokens.

Clerk may return `expiration: null` for a valid opaque access token. Pecu accepts that token only after live verification reports that it is neither revoked nor expired. Every HTTP request repeats that verification. Pecu omits the SDK's optional expiry value instead of inventing a token lifetime. JWT access tokens must have a verified finite expiry.

## Clerk configuration

Use the instance whose publishable key builds the Stocks app. Do not create a separate Clerk instance.

1. Open **OAuth applications** in that instance's Clerk Dashboard.
2. Under **Scopes**, create `pecu:read` for Pecu reads and `pecu:write` for tool actions that change data or prepare a transaction. Advertise these scopes in Clerk's OAuth metadata. Assign them to the OAuth clients allowed to connect. Advertising a scope alone does not assign it to a client.
3. Enable resource-bound audiences. Clerk's instance setting `aud_claim_enabled` must be `true`; it allows the RFC 8707 `resource` parameter to populate the access token's audience. Without it, Pecu rejects the token.
4. In **Settings**, enable **Require PKCE**. Clerk must reject authorization requests without `S256`.
5. Under **Client onboarding**, enable **Publish CIMD support**. Explicitly allow the metadata-document URLs of the MCP clients you intend to use. Allow previously unknown clients only when that is intended. Set the dynamic client's default scopes to `pecu:read`; grant `pecu:write` through explicit authorization when needed.
6. Keep the OAuth consent screen enabled. Clerk's Account Portal shows the requesting application and permissions and handles allow, deny, and sign-in with the existing account.
7. Choose **Opaque access tokens** for immediate revocation. Pecu verifies each request through Clerk's Backend API and does not cache access-token verification.
8. Enable **Publish DCR support** only for clients that need dynamic client registration and cannot use CIMD or a pre-registered client. DCR is retained for older clients in the MCP 2026-07-28 specification. A pre-registered public client must have its exact redirect URIs configured and use PKCE.

The authorization server's discovery URL is the Clerk Frontend API domain followed by `/.well-known/oauth-authorization-server`. Pecu derives that domain from `VITE_CLERK_PUBLISHABLE_KEY`. Discovery must advertise the actual OAuth authorization and token endpoints, `S256`, and the enabled client onboarding mechanisms.

Before enabling a production MCP client, complete an authorization-code flow with `resource=https://pecu.app/mcp`. Verify that Clerk's returned access-token verification document includes `aud: ["https://pecu.app/mcp"]`. Pecu fails closed when Clerk omits that binding. Do not remove the audience check to work around an older OAuth implementation.

The Clerk CLI can read the targeted instance's OAuth settings without reading secret-bearing application configuration:

```sh
clerk api /instance/oauth_application_settings --app <existing-app-id> --instance <exact-instance-id>
```

Confirm `aud_claim_enabled: true`, `pkce_required: true`, `oauth_jwt_access_tokens: false`, `client_id_metadata_documents_advertised: true`, `client_id_metadata_documents_only_allow_pre_registered_clients: true`, and `default_scopes: ["pecu:read"]`. Use the exact instance ID whose Frontend API domain matches the discovery issuer. These settings, both Pecu scopes and the admitted Codex client are configured in the existing instance.

## Codex

Use CIMD for Codex onboarding. In Clerk, pre-register and allow this client metadata URL, with `pecu:read` and `pecu:write` available for consent:

```text
https://chatgpt.com/oauth/codex/client.json
```

Codex chooses CIMD when discovery advertises `client_id_metadata_document_supported: true`, token authentication supports `none`, and the callback uses a supported loopback URL. The stable URL also requires `authorization_response_iss_parameter_supported: true`, a valid issuer, and a matching `iss` in the authorization response. Accept variable ports for `http://127.0.0.1:<port>/callback`, as required for native OAuth clients. See [Codex OAuth client registration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#oauth-client-registration).

Add the server and sign in with the existing Pecu account:

```sh
codex mcp add pecu --url https://pecu.app/mcp --oauth-client-registration cimd
codex mcp login pecu --oauth-client-registration cimd
```

`mcp add` can start login immediately. Use `mcp login` for a new consent flow. Codex discovers the resource from Pecu's protected resource metadata. Do not set `oauth_resource` or pass `--oauth-resource` for this connection in Codex 0.159.3. The explicit setting duplicated the automatically discovered `resource` parameter in the live authorization request, and Clerk rejected it with `invalid_target`. Removing the setting produced one resource parameter and completed login.

The initial resource metadata advertises `pecu:read`. Request both Pecu permissions and refresh access explicitly when actions are needed:

```sh
codex mcp login pecu --oauth-client-registration cimd --scopes pecu:read,pecu:write,offline_access
```

On 2026-10-02, Codex CLI 0.159.3 completed a real Google sign-in to the existing Clerk account, displayed consent for both Pecu scopes, completed the CIMD callback and reported successful login. The request included `pecu:read`, `pecu:write` and `offline_access`. Live tool discovery, the access token's verified audience and an authenticated tool read still need verification. Login success alone does not establish tool access.

If CIMD is unavailable, pre-register a public PKCE client in Clerk and pass its ID:

```sh
codex mcp add pecu --url https://pecu.app/mcp --oauth-client-id YOUR_CLERK_CLIENT_ID
```

Register the exact callback printed by Codex. Newly added clients use the stable callback when issuer binding is supported; other configurations can include a server-specific path. A configured client ID skips dynamic registration. See [Codex callbacks](https://learn.chatgpt.com/docs/extend/mcp?surface=cli#oauth-client-registration-and-callbacks).

The Pecu backend, Stocks/MCP Worker and public site are deployed. Canonical protected resource discovery returns HTTP 200, and unauthenticated MCP requests return HTTP 401 with the OAuth challenge. Clerk configuration and a real Codex login are verified. Authenticated catalog and tool verification remain pending.

## Worker configuration

The Stocks Worker already holds `CLERK_SECRET_KEY` and the same publishable key. MCP uses those existing credentials. The public site forwards `/mcp` and its discovery routes to that Worker. The Stocks Worker forwards authenticated tool calls through the existing `PECU` service binding.

`VITE_PECU_MCP_URL` optionally overrides the resource URL for an isolated development or preview deployment. It must be an absolute HTTPS URL ending in `/mcp`. HTTP is accepted only on localhost. Build the app with the final resource URL; do not derive the audience from an untrusted incoming Host header.

Read tools require `pecu:read`. Other tools require both `pecu:read` and `pecu:write`. A read connection attempting an action receives HTTP 403 with `insufficient_scope` and both required permissions. OAuth write consent grants access to the tool; MCP transaction tools create persisted unsigned previews for confirmation in Pecu.

## Disconnect

Revoke the client's grant or access token in Clerk. An opaque token stops working on the next request. Existing transaction previews retain their normal expiration and cancellation rules. Disconnecting a client does not undo a submitted transaction.

Remove Codex's locally stored OAuth credentials with `codex mcp logout pecu`. Local logout does not revoke a grant at Clerk; revoke it there when disconnecting the client.

## References

- [Clerk OAuth configuration](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth)
- [Clerk Client ID Metadata Documents](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents)
- [Clerk OAuth token verification](https://clerk.com/docs/guides/configure/auth-strategies/oauth/verify-oauth-tokens)
- [Clerk Backend API schema](https://raw.githubusercontent.com/clerk/openapi-specs/main/bapi/2026-05-12.yml)
- [MCP 2026-07-28 authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Codex MCP configuration and OAuth](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
