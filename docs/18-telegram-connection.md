# Telegram and BuddyTG

BeeGreat has two deliberately separate Telegram adapters behind one product
concept:

- The cloud adapter uses Telegram OpenID Connect with PKCE and the
  `telegram:bot_access` scope. It links the signed-in BeeGreat user to a
  Telegram user id and lets BeeGreat's bot send plain direct messages only to
  that user. Mobile, web, the agent, and the Bee CLI share this connection.
- The local BuddyTG adapter uses MTProto and macOS Keychain. It can work with
  personal chats, Saved Messages, and files, but stays on the user's Mac. The
  Bee CLI exposes it as `bee buddytg <args...>` without copying its session into
  BeeGreat or the cloud.

Telegram Login proves identity and grants bot direct-message access. It does
not grant access to the user's chat history or permission to send as the user;
those capabilities require the separate local MTProto session.

## Configure Telegram Login

1. In @BotFather, open the BeeGreat bot and choose **Login Widget**.
2. Add the exact callback URL
   `https://<deployment>.convex.site/telegram/oauth/callback` to Allowed URLs.
3. Keep the default RS256 signing algorithm (ES256 also works).
4. Set the Convex environment values:

```sh
bunx convex env set TELEGRAM_BOT_TOKEN '<bot-token>'
bunx convex env set TELEGRAM_OIDC_CLIENT_ID '<client-id>'
bunx convex env set TELEGRAM_OIDC_CLIENT_SECRET '<client-secret>'
bunx convex env set TELEGRAM_OIDC_REDIRECT_URI 'https://<deployment>.convex.site/telegram/oauth/callback'
bunx convex env set TELEGRAM_APP_REDIRECT_URI 'beegreat://profile'
bunx convex env set TELEGRAM_CONNECTION_KEY '<base64-32-byte-key>'
```

Generate `TELEGRAM_CONNECTION_KEY` once with `openssl rand -base64 32`. Do not
put any of these values in `VITE_*` or `EXPO_PUBLIC_*` variables. Rotating the
key only invalidates pending, ten-minute login sessions; completed connections
store no OAuth or MTProto token.

The agent uses the existing private `AGENT_CREDENTIAL_BROKER_SECRET` route.
Clients never receive the bot token, OIDC client secret, Telegram user id, PKCE
verifier, or nonce.

## User flows

- Mobile: Profile → Connections → Continue with Telegram.
- Web: Settings → Connections → Continue with Telegram.
- CLI: `bee telegram connect`, `status`, `notify`, or `disconnect`.
- Full local BuddyTG: `bee buddytg login`, `whoami`, `chats`, `send`, and the
  remaining upstream commands.
