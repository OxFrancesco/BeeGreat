# iMessage identity by magic link, owned by Convex

An iMessage sender is bound to a BeeGreat account by a single-use, 15-minute
magic link delivered only to that address; opening it in a Clerk-signed-in
browser proves control of the channel and writes one `imessageConnections`
row in Convex. The bridge holds no identity data or allowlist — it resolves
every sender through the agent worker (`/bridge/identity`, bridge secret)
which forwards to the Convex broker (`/internal/imessage`, broker secret) —
so Convex remains the single authority over channel identities, re-linking a
token moves an address to whoever controls it now, disconnection works from
every client, and account deletion erases the mapping. This replaces the
static `IMESSAGE_USER_MAP` environment variable, whose per-deploy edits could
not sign up new users, could not be revoked by the user, and forked identity
state outside the backend.
