# BeeGreat App Store release packet

This directory is the version-controlled source of truth for the BeeGreat
1.0.0 App Store submission. It prepares copy, review guidance, questionnaire
recommendations, and screenshot production without treating any dashboard-only
step as complete.

## Release facts

| Field | Value |
| --- | --- |
| App | BeeGreat |
| Version | 1.0.0 |
| Bundle ID | `com.beegreat.app` |
| App Store Connect app ID | `6787693647` |
| Primary category | Productivity |
| Secondary category | Lifestyle |
| Subscription | BeeGreat Pro Monthly |
| Product ID | `com.beegreat.app.pro.monthly` |
| U.S. price | $6.99 per month |
| Trial | None |
| Terms | <https://beedocs.pages.dev/terms> |
| Privacy | <https://beedocs.pages.dev/privacy> |
| Support | <https://beedocs.pages.dev/support> |

## Current automated state

As of July 17, 2026:

- The Terms, Privacy, and Support pages are deployed at the canonical URLs
  above, return HTTP 200, and match the current local production build. Legal
  operator, postal address, governing law, and public contact confirmation
  remain release-owner inputs.
- The App Store Connect app, version 1.0.0, en-US metadata, categories,
  age-rating answers, content-rights declaration, and BeeGreat Pro Monthly
  subscription record have been created. The subscription is configured as a
  one-month product with no trial and a U.S. price of $6.99.
- Five iPhone 6.9-inch and five iPad 13-inch screenshots are uploaded and
  complete in App Store Connect. Both sets also pass the local App Store
  Connect dimension and file validation.
- The canonical App Store Connect preflight currently reports three blocking
  items: missing App Review contact details, no attached release build, and no
  configured app availability. App Privacy publication, agreements/tax/banking,
  Digital Services Act status, and the production Clerk and RevenueCat dashboard
  configuration remain manual work.
- The live localized paywall and subscription App Review screenshot remain
  blocked until RevenueCat is configured against the Apple product and a live
  StoreKit price can be verified. No app version or subscription has been
  submitted to App Review.

## Contents

- [`metadata/en-US.json`](metadata/en-US.json) is the canonical en-US store
  copy and release configuration.
- [`asc/`](asc/) contains the same localized fields in the deterministic
  `.strings` format accepted by `asc localizations upload`.
- [`review-notes.md`](review-notes.md) contains copy-ready App Review notes plus
  the verification conditions that must be true before pasting them.
- [`compliance-questionnaires.md`](compliance-questionnaires.md) records the
  recommended age-rating and App Privacy answers with their rationale.
- [`screenshots.md`](screenshots.md) defines the iPhone, iPad, and subscription
  review screenshot plan and deterministic filenames.
- [`account-deletion.md`](account-deletion.md) is the implementation and
  production-configuration inventory for Apple's account-deletion review.
- [`screenshot-plan.json`](screenshot-plan.json) is the machine-readable shot
  manifest.
- [`manual-checklist.md`](manual-checklist.md) covers web-only, legal, account,
  subscription, and final review work.
- [`validate.ts`](validate.ts) checks Apple's field limits and release
  invariants without contacting App Store Connect.

## Validation

From the repository root:

```bash
bun release/app-store/validate.ts
```

To validate the App Store Connect upload files without mutating the remote app:

```bash
asc localizations upload \
  --version "a5f136a8-3f77-4680-91a0-3724e124a679" \
  --locale "en-US" \
  --path "release/app-store/asc/version-localizations/en-US.strings" \
  --dry-run

asc localizations upload \
  --app "6787693647" \
  --type app-info \
  --app-info "bfbdf0fd-f97a-49c3-861e-f7abbefdb0f8" \
  --locale "en-US" \
  --path "release/app-store/asc/app-info-localizations/en-US.strings" \
  --dry-run
```

The packet does not contain review credentials, a phone number, signing
secrets, or RevenueCat keys. Add those only to the appropriate secure service
or App Store Connect field.

## Submission rule

The first BeeGreat subscription must be attached to version 1.0.0 and submitted
with that app version. Do not submit the subscription separately first. The
build used for this release must support both iPhone and iPad before the iPad
screenshots in this packet are uploaded.
