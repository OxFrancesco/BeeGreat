# App Review notes

## Preconditions before pasting

Paste the notes below only after all of these statements have been verified in
the submitted build and production configuration:

- Sign in with Apple works, and App Review has a non-personal review path that
  does not require the reviewer to expose personal credentials.
- The review access details are stored in App Store Connect's secure Demo
  Account fields; no credential belongs in this repository or in the free-text
  notes.
- `com.beegreat.app.pro.monthly` is available to Apple's sandbox and attached to
  version 1.0.0 as the first subscription.
- Purchase, Restore Purchases, Manage Subscription, Terms, and Privacy links all
  work in the submitted binary.
- The account-deletion flow is present at the path stated below and has been
  tested end to end, including the signed Clerk `user.deleted` webhook and a
  forced retry of background cleanup.
- Bee works without connecting ChatGPT, Google Health, a Beennector, or wallet
  tools.

If the review account is pre-entitled through RevenueCat, say so explicitly in
App Store Connect. Otherwise, leave it unentitled so Apple can review the first
subscription purchase through its sandbox.

## Copy-ready notes

```text
BeeGreat 1.0.0 is an AI-assisted focus app. It helps a signed-in user turn an outcome into an editable Goal, Project, Tasks, and one highlighted next action, then reflects completed work in the user's Hive.

REVIEW ACCESS
Use the non-personal review access supplied in the secure Demo Account fields in App Store Connect. No credentials are included in this note. Sign in with Apple is also available in the app.

SUBSCRIPTION
An active BeeGreat Pro Monthly subscription is required after sign-in.
Product ID: com.beegreat.app.pro.monthly
Duration: one month
U.S. price: $6.99
Free trial: none

For the first-subscription review, sign in and continue to the BeeGreat Pro screen. The screen displays Apple's localized price and billing period. Tap Subscribe to use Apple's sandbox purchase flow. Tap Restore Purchases on the same screen to test restoration. After access is active, subscription management is available from Profile > BeeGreat Pro.

CORE REVIEW PATH
1. Open Bee and type: "Help me plan a focused morning." Voice input is optional.
2. Review the editable Goal, Project, Tasks, and Highlight proposed by Bee, then confirm or cancel it.
3. Open Goals to inspect the resulting structure and highlighted Task.
4. Complete the highlighted Task, then open Hive to see Honey and Honeycomb Score progress.
5. Open Mind to save and revisit a useful link.
6. Open Profile for subscription management, optional connections, legal links, and account deletion.

OPTIONAL CONNECTIONS
ChatGPT is optional; BeeGreat has a built-in provider when it is not connected. Google Health is opt-in and read-only. GitHub, Linear, and Notion Beennectors, plus wallet tools, are optional and are not needed to review the core app. Each connection requires the user's separate authorization and can be disconnected in Profile.

HEALTH AND AI
Google Health data is used only after explicit opt-in to support general wellness goals. BeeGreat does not diagnose, treat, or act as a medical device. Bee uses generative AI and may make mistakes; the interface asks users to review proposed changes before confirming them.

ACCOUNT DELETION
To initiate permanent account deletion, open Profile, choose Delete Account, and confirm the destructive action. BeeGreat deletes the Clerk sign-in identity first, then starts active-system cleanup in the background. Cleanup normally begins immediately when online; a bounded tombstone drives safety sweeps for up to 30 days and contains no product content. The user does not need to keep the app open. The confirmation explains that deletion does not cancel an Apple subscription and cannot erase public blockchain records, Apple purchase history, or independently controlled provider data.

LEGAL
Terms: https://beedocs.pages.dev/terms
Privacy: https://beedocs.pages.dev/privacy
Support: https://beedocs.pages.dev/support
```

## Subscription product review note

```text
BeeGreat Pro Monthly unlocks the full BeeGreat experience after sign-in: Bee AI chat and voice, Goals, Projects, Tasks, Hive progress, Mind bookmarks, and optional connections. There is no free trial.

The BeeGreat Pro screen appears immediately after an unentitled user signs in. It shows Apple's localized one-month price, Subscribe, Restore Purchases, Terms of Use, and Privacy Policy. This first subscription will be submitted with BeeGreat 1.0.0. Secure review access and detailed test steps are supplied in the app version's App Review Information.
```

## Review information fields still requiring an owner

These values must be supplied directly in App Store Connect and are deliberately
not guessed here:

- Contact first and last name
- Monitored review email address
- Reachable international-format phone number
- Secure demo/review access and any one-time setup instructions

The contact must be able to answer subscription, AI, health, wallet, and
Beennector questions during the review window.
