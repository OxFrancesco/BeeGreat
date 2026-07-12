# Google Health power-up

BeeGreat's Google Health power-up provides read-only access to the Google Health API v4 through an opt-in specialist. It follows the upstream [`ghealth`](https://github.com/Google-Health-API/google-health-cli) operation model while keeping OAuth tokens encrypted in Convex rather than on the mobile device.

## Capability

- Reads steps, heart rate, exercise, sleep, weight, body measurements, SpO2, HRV, nutrition, and other supported health data.
- Uses daily rollups for cumulative totals such as steps, distance, floors, active minutes, and total calories.
- Limits every tool request to a 31-day range and a bounded first page.
- Does not expose create, update, delete, ECG, irregular-rhythm, location-route, or webhook operations.
- Treats absent rollup days as missing data, not zero.

## Google Cloud setup

1. Enable the Google Health API in a Google Cloud project.
2. Create a Web application OAuth client.
3. Add the deployed callback URL as an authorized redirect URI:

   ```text
   https://<deployment>.convex.site/google-health/oauth/callback
   ```

4. Add BeeGreat's test accounts while the consent screen is in Testing.
5. Add the six read-only Google Health scopes used in `googleHealthOAuth.ts` to the OAuth consent screen.

All Google Health scopes are restricted. Production access beyond the unverified-app limit requires Google's verification and third-party security review.

## Convex environment

Generate a dedicated encryption key and set the OAuth values with Bun:

```bash
openssl rand -base64 32
bunx convex env set GOOGLE_HEALTH_CLIENT_ID '<client-id>'
bunx convex env set GOOGLE_HEALTH_CLIENT_SECRET '<client-secret>'
bunx convex env set GOOGLE_HEALTH_REDIRECT_URI 'https://<deployment>.convex.site/google-health/oauth/callback'
bunx convex env set GOOGLE_HEALTH_CREDENTIALS_KEY '<base64-32-byte-key>'
bunx convex env set GOOGLE_HEALTH_APP_REDIRECT_URI 'beegreat://profile'
```

Do not put any of these secrets in an `EXPO_PUBLIC_` variable. Do not rotate `GOOGLE_HEALTH_CREDENTIALS_KEY` without first disconnecting or migrating every stored credential.

## Mobile testing

Use a development or production build that owns the `beegreat` URL scheme. The Google browser flow redirects through Convex and returns to `beegreat://profile`; Expo Go does not own that application scheme.

1. Open Profile → Power-ups.
2. Enable Google Health.
3. Tap Connect and approve the requested read-only scopes.
4. Ask Bee for a bounded health question, such as weekly step totals or recent sleep sessions.

Testing-mode Google refresh tokens expire after seven days. A production consent screen generally avoids that short lifetime, subject to Google revocation and inactivity rules.
