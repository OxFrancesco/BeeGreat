# Pecu waitlist

The pecu.app homepage has an email waitlist for Pecu's planned public launch.
Visitors enter an email address, tick a consent box and press Join. `/waitlist`
in a browser redirects to the form at `/#waitlist`.

## What a visitor sees

- An empty or malformed address shows "Enter a full email address, like
  name@example.com." and marks the field.
- An unticked box shows "Tick the box so Pecu can email you about the launch."
- A saved address shows "You're on the list. Pecu will email you when it
  launches." and disables the form.
- After five attempts from one network within ten minutes, further attempts show
  "Too many attempts from this network." until the window passes.
- A network or server failure keeps the form usable and asks the visitor to try
  again.

An address that is already on the list gets the same success answer as a new one,
so the form cannot be used to check who signed up. There is no public list or
count.

The consent text is "Email me about Pecu's launch. To be removed, write to
info@pecu.app." It does not cover other marketing. Joining is not a token sale and
does not reserve tokens, rewards or access.

## How it works

The browser posts JSON to `POST /waitlist` on the `pecu-app` gateway. The gateway
accepts only same-origin JSON bodies up to 1 KB and forwards them, with the
visitor's `CF-Connecting-IP`, to the `WaitlistGateway` entrypoint on the
`basedbot` Worker. That entrypoint can only reach the waitlist; it does not expose
chat, wallet or profile routes.

The `basedbot-main` Durable Object stores signups in SQLite table `pecu_waitlist`
(`src/waitlist.ts`): the address trimmed and lower-cased, the consent version
`launch-email-2026-10`, and the time it was first saved. A repeat submission
keeps the original row. Requests with extra fields, such as a wallet address or
seed phrase, are rejected rather than stored. Attempt counts for rate limiting
stay in memory, so visitor IP addresses are never written to storage. Nothing
logs the address or the request body.

No email is sent by this feature. Sending a launch email is a separate decision.

## Owner access

Only the operator holding `ADMIN_TOKEN` can read or change the list. Requests to
`/admin/*` without the bearer token return 404.

```sh
cd apps/pecu
bun run waitlist list            # JSON
bun run waitlist csv > waitlist.csv
bun run waitlist remove person@example.com
```

The script reads `ADMIN_TOKEN` from the environment or the macOS keychain item
`com.oddofrancesco.basedbot.admin-token`, and calls
`https://basedbot.oddofrancesco000.workers.dev` unless `PECU_ADMIN_ORIGIN` is set.
CSV cells that start with `=`, `+`, `-` or `@` are prefixed with `'` so a
spreadsheet does not run them as formulas. The same routes work directly:
`GET /admin/waitlist` and `POST /admin/waitlist/remove` with `{"email": "..."}`.

Removal requests sent to info@pecu.app are handled with `remove`. It reports
whether the address was on the list.

## Deployment

Deploy `basedbot` before `pecu-app`. The gateway's `WAITLIST` service binding
names the `WaitlistGateway` entrypoint, which exists only after the backend
deploy. The table is created by the Durable Object constructor; there is no
migration step.

## Verification

The flow was checked locally with both Workers under `wrangler dev`, using a
throwaway admin token and separate local storage, with no production secrets
loaded. Checks covered new, duplicate (different case), malformed, unticked,
extra-field, malformed JSON, cross-origin, form-encoded, oversized and
rate-limited submissions; owner list, CSV and removal; rejected admin requests
without the token; persistence across a backend restart; and the form at 1440px
and 375px widths.
