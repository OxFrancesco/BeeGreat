# App Store release checklist

Unchecked items are release work, not documentation suggestions. Preserve
screenshots or exported confirmations for every dashboard-only item.

## Legal pages and public contact

- [ ] Terms, Privacy, and Support URLs return HTTP 200 without authentication
      on desktop and mobile Safari.
  - The canonical production pages were deployed and their HTTP 200 responses
    and deployed bytes were verified on July 16, 2026; desktop and mobile Safari
    rendering still require release QA.
- [ ] Terms identify the contractual seller, renewal/cancellation rules,
      AI limitations, health/wellness limitations, connected services, account
      termination, governing law, and a monitored contact.
- [ ] Decide whether the published Terms remain a supplemental in-app contract
      alongside Apple's Standard EULA or replace it with a custom App Store EULA.
      App Store Connect currently has no custom EULA; do not upload one until the
      legal operator, governing law, and intended territories are confirmed.
- [ ] Privacy Policy matches the submitted build's data flows, processors,
      retention, deletion, user rights, and international transfers.
- [ ] Support provides a monitored contact and a practical route for billing,
      privacy, accessibility, and account-deletion requests.
- [ ] Confirm `2026 Francesco Oddo` matches the legal rights holder shown in
      Agreements, Tax, and Banking. Update the metadata if the contractual seller
      is a company or different person.

## App Store Connect account and web-only declarations

- [ ] The Account Holder has accepted the current Apple Developer Program and
      Paid Applications agreements.
- [ ] Tax forms and banking details are complete, verified, and able to receive
      paid-app proceeds in every selected territory.
- [ ] Confirm the public seller name and address shown on the product page are
      correct.
- [ ] Complete the Digital Services Act status. A commercial app selling a
      subscription in the EU will ordinarily need a **Trader** declaration; confirm
      the legal classification, verify the public phone/email/address, upload any
      requested evidence, and do not distribute in the EU until this is resolved.
- [ ] Complete App Privacy in the App Store Connect web UI using
      `compliance-questionnaires.md`, the submitted archive's privacy manifests,
      App Privacy Report evidence, and current processor documentation.
- [ ] Answer medical-device functionality **No** only after confirming the
      release makes general wellness claims only and provides no diagnosis,
      treatment, dosing, measurement, or clinical decision support.
- [ ] Complete content-rights and export-compliance declarations for the exact
      binary; retain the supporting rationale.

## App record and release version

- [ ] App Store version is exactly `1.0.0`, matching the submitted build.
  - Version 1.0.0 exists in App Store Connect; no release build is attached yet.
- [x] Primary category is Productivity and secondary category is Lifestyle.
- [x] The app itself is free; monetization is only the auto-renewable
      subscription described below.
- [ ] Availability is explicitly selected for intended territories and agrees
      with legal/privacy/DSA readiness.
  - App availability is one of the three current canonical validation blockers.
- [x] en-US subtitle, description, keywords, promotional text, Support URL,
      Marketing URL, Privacy URL, and copyright match `metadata/en-US.json`.
- [ ] Age-rating answers match `compliance-questionnaires.md` after final AI and
      remote-feature testing.
- [ ] Content rights are documented for any web, AI, connected-service, icon,
      screenshot, and third-party content shown or processed by the app.

## Subscription and RevenueCat

- [x] Auto-renewable subscription group is named BeeGreat Pro.
- [ ] Product `com.beegreat.app.pro.monthly` is BeeGreat Pro Monthly, has a
      one-month duration, no free trial or introductory offer, and a $6.99 U.S.
      base price with Apple's localized territory prices reviewed.
  - Product identity, duration, no-offer state, U.S. price, and a complete
    175-territory price matrix are configured; human review of localized
    prices is still pending.
- [x] Subscription localization accurately names the plan and describes its
      ongoing value without promising unavailable features.
- [ ] Subscription availability matches the app's release territories.
- [ ] RevenueCat maps the Apple product to entitlement `pro` and the current
      monthly offering/package used by the submitted build.
- [ ] RevenueCat's Apple app uses bundle ID `com.beegreat.app` and has a valid
      App Store Connect In-App Purchase key (`.p8`, key ID, and issuer ID).
      RevenueCat requires this key for StoreKit 2 / React Native Purchases 8+
      transaction validation; confirm every credential check is green.
- [ ] Add an App Store Connect API key with at least App Manager access to
      RevenueCat so products and prices can be imported and checked against
      Apple. Store the one-time-download `.p8` outside the repository.
- [ ] Set Apple's App Store Server Notifications V2 production and sandbox URLs
      to the RevenueCat URL shown for this app (or use RevenueCat's **Apply in
      App Store Connect** action), then verify delivery after a sandbox purchase.
- [ ] The production RevenueCat public SDK key is injected through the secure
      production environment, not committed to this packet.
- [ ] Purchase, cancellation, billing retry, expiration, refund, cross-device
      entitlement, account switching, Restore Purchases, and Manage Subscription
      have been tested with Apple sandbox/TestFlight receipts.
- [ ] The paywall displays StoreKit's live localized price and duration, the
      auto-renew disclosure, Subscribe, Restore Purchases, Terms, and Privacy.
- [ ] Upload the raw subscription review screenshot from `screenshots.md`.
  - Both items remain blocked until the RevenueCat dashboard is connected to
    the Apple product and the submitted app can display a verified live
    localized StoreKit price. Do not substitute a mocked price screenshot.
- [ ] Because this is BeeGreat's first subscription, attach it to app version
      1.0.0 and submit both together. Do not send the subscription for standalone
      review first.

## Authentication, accounts, and privacy controls

- [ ] Sign in with Apple works anywhere the Google sign-in option is offered.
- [ ] Configure Clerk's production `user.deleted` webhook to
      `/webhooks/clerk`, store its signing secret as
      `CLERK_WEBHOOK_SIGNING_SECRET`, and verify a signed delivery activates an
      interrupted deletion job.
- [ ] Set the backend `AGENT_URL` and the same server-only
      `AGENT_CREDENTIAL_BROKER_SECRET` used by the Flue Worker; verify deletion
      clears every known Bee Durable Object conversation.
- [ ] Confirm the production RevenueCat secret key is authorized to delete a
      subscriber record, and verify the cleanup treats an already-deleted customer
      as success without cancelling the App Store subscription.
- [ ] Verify account deletion revokes supported Google Health, GitHub, Linear,
      and Notion grants before encrypted credentials are purged; simulate a 5xx to
      confirm idempotent retry and watchdog recovery.
- [ ] Configure Convex `CLERK_SECRET_KEY`, `APPLE_SIGN_IN_CLIENT_ID`,
      `APPLE_SIGN_IN_TEAM_ID`, `APPLE_SIGN_IN_KEY_ID`, and
      `APPLE_SIGN_IN_PRIVATE_KEY`. The client ID must be the exact App ID or
      Services ID that minted the access token returned by Clerk.
- [ ] Test account deletion with (1) a Clerk user for whom the Apple token
      endpoint returns an access token, (2) a native Sign in with Apple user for
      whom Clerk returns an explicit empty token list, (3) invalid Apple
      credentials, and (4) simulated Clerk/Apple timeouts. Only the explicit empty
      list may use the manual Apple Account settings fallback; every error must
      leave the Clerk identity and BeeGreat data intact.
- [ ] Keep the Apple Account settings fallback in the app, Privacy Policy, and
      Support page. The installed Clerk Expo native hook exchanges only Apple's ID
      token, so Clerk may have no access/refresh token that Apple's `/auth/revoke`
      endpoint accepts. Apple TN3194 explicitly requires deletion to continue in
      that no-token case and directs the user to revoke access manually.
- [ ] Confirm with Crossmint whether the production Wallets contract provides a
      supported delete or ownership-detach operation. The documented Wallets API
      currently exposes create/read and signer management, not wallet deletion;
      BeeGreat deletes its local cache but cannot erase a smart contract wallet or
      public on-chain history.
- [ ] A user can restore the same BeeGreat/RevenueCat identity after signing in
      on another device; no entitlement leaks between Clerk accounts.
- [ ] In-app account deletion is easy to find, confirms the destructive action,
      deletes or schedules deletion of all user-controlled data, and explains any
      legally retained purchase/security records.
- [ ] Disconnect flows revoke/delete stored ChatGPT, Google Health, GitHub,
      Linear, and Notion credentials as promised, and describe the Web3 limitation
      accurately rather than promising deletion of a wallet or blockchain history.
- [ ] Permissions are requested in context and denied permissions leave the app
      usable with a clear recovery path.

## Build, devices, screenshots, and accessibility

- [ ] The release archive supports both iPhone and iPad; its device-family
      declaration, orientations, signing, entitlements, version, and build number
      match the App Store record.
- [ ] Core purchase, restore, sign-in, voice, Goals, Hive, Mind, Profile,
      legal-link, and deletion flows pass on the oldest supported iPhone and iPad
      OS/device classes.
- [ ] iPad screens are deliberately laid out for iPad and do not render as a
      stretched phone UI.
- [x] Produce, privacy-review, validate, and upload the five iPhone 6.9-inch
      screenshots in the prescribed order.
- [x] Produce, privacy-review, validate, and upload the five iPad 13-inch
      screenshots in the prescribed order.
- [ ] Voice input has an equivalent text path; controls have accessible labels,
      Dynamic Type/VoiceOver behavior is checked, and contrast/tap targets meet the
      product's accessibility claims.
- [ ] No screenshot or review attachment contains personal data, credentials,
      OAuth codes, health data, wallet identifiers, or unlicensed third-party
      content.

## App Review access and final handoff

- [ ] Enter a real monitored review contact name, email, and reachable
      international-format phone number. No phone is invented in this repository.
  - Missing review contact details are one of the three current canonical
    validation blockers.
- [ ] Provide non-personal demo/review access through App Store Connect's secure
      fields. Confirm it works from a fresh device and does not depend on a personal
      Google/Apple/ChatGPT account or an expiring code.
- [ ] Seed only fictional review content and document how to reset it.
- [ ] Paste `review-notes.md` only after every stated path is true in the exact
      submitted build.
- [ ] Attach the processed universal build and first subscription to version
      1.0.0, then run the canonical App Store Connect validation/preflight.
  - No build is attached; this is one of the three current canonical validation
    blockers. The other two are review contact details and app availability.
- [ ] Resolve every error and re-check warnings against the intended release.
- [ ] Obtain an explicit final approval from the release owner before submitting
      the app version and subscription to App Review.
  - No App Review submission has been created.
