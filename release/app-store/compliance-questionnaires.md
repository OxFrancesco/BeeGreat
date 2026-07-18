# App Store compliance questionnaires

These are evidence-based recommendations for BeeGreat 1.0.0, not completed
dashboard declarations or legal advice. Re-check them against the exact
production build, every enabled remote feature, each SDK privacy manifest, and
Apple's current definitions immediately before submission.

## Age rating

BeeGreat is a focus and productivity app with constrained AI chat. It is not a
web browser, social network, gambling product, medical app, or advertising
surface. The optional Google Health connection makes health/wellness the one
content capability that should be answered affirmatively.

| App Store Connect question | Recommended answer | Rationale / verification |
| --- | --- | --- |
| Advertising | No | No ad SDK or paid placement is part of 1.0.0. |
| Age assurance | No | No age-verification flow exists. |
| Parental controls | No | No parent-managed controls exist. |
| Messaging and chat | Yes | The user converses with Bee's AI chat. |
| User-generated content | No | Personal prompts and plans are not published to or browsable by other users. Change to Yes if any sharing/social surface ships. |
| Unrestricted web access | No | Saved links and OAuth pages open in a constrained/system browser; BeeGreat is not a general-purpose browser. |
| Health or wellness topics | Yes | Optional read-only Google Health data can inform general wellness goals. |
| Medical or treatment information | None | The app provides no diagnosis, treatment plan, dosing, or clinical guidance. Keep the wellness disclaimer visible. |
| Alcohol, tobacco, or drug references | None | Not part of the product surface. Re-test open-ended AI responses. |
| Profanity or crude humor | None | Not an intended output of the focus-scoped agent. If production safety testing finds occasional output, use Infrequent or Mild. |
| Mature or suggestive themes | None | Not part of the product surface. Re-test open-ended AI responses. |
| Horror or fear themes | None | Not part of the product surface. |
| Sexual content or nudity | None | Not part of the product surface. |
| Graphic sexual content or nudity | None | Not part of the product surface. |
| Cartoon or fantasy violence | None | Not part of the product surface. |
| Realistic violence | None | Not part of the product surface. |
| Prolonged graphic or sadistic realistic violence | None | Not part of the product surface. |
| Guns or other weapons | None | Not part of the product surface. |
| Contests | None | Hive progression is personal productivity feedback, not a contest in 1.0.0. |
| Simulated gambling | None | No gambling simulation exists. |
| Real gambling | No | No wagering exists. |
| Loot boxes | No | The subscription buys access, not randomized virtual items. |
| Rating override | None | Do not override the questionnaire's calculated rating. |
| Kids category / age band | Not selected | BeeGreat is not submitted to the Kids category. |

If the AI is later allowed to answer arbitrary topics, or social Hive features
ship remotely, repeat the full questionnaire before enabling them in production.

## App Privacy

Do not choose **Data Not Collected**. BeeGreat stores account and product data in
Clerk/Convex, processes purchases through Apple and RevenueCat, transmits voice
audio for transcription, optionally reads connected-service data, and sends
content-redacted diagnostics to Sentry.

Recommended global answers:

- Data used to track the user across other companies' apps or websites: **No**.
- Third-party advertising: **None**.
- Developer advertising or marketing: **None** for 1.0.0.
- Data sale: **None**.
- Primary purposes: **App Functionality**, with **Product Personalization** for
  the user's own agent context and **Analytics** for diagnostics/usage signals.

### Data-type map

| Apple data type | Linked to user | Tracking | Purposes | BeeGreat source / use |
| --- | --- | --- | --- | --- |
| Contact Info — Name | Yes | No | App Functionality | Optional account profile supplied through Clerk/Apple/Google sign-in. |
| Contact Info — Email Address | Yes | No | App Functionality | Account identity and support/security communication through Clerk. |
| Health & Fitness — Health | Yes, only when enabled | No | App Functionality, Product Personalization | Read-only Google Health records selected by the user. |
| Health & Fitness — Fitness | Yes, only when enabled and returned by Google Health | No | App Functionality, Product Personalization | Activity/fitness data used for user-requested wellness goals. Confirm the exact production scopes. |
| Financial Info — Other Financial Info | Yes, only when wallet tools are enabled | No | App Functionality | Public wallet address, network, and balance/activity needed for user-requested wallet operations. Payment-card data is not collected. |
| Purchases — Purchase History | Yes | No | App Functionality, Analytics | Subscription product, entitlement, renewal, and transaction state from Apple/RevenueCat. |
| Identifiers — User ID | Yes | No | App Functionality, Analytics | Clerk subject ID; also used as the RevenueCat App User ID and redacted Sentry correlation ID. |
| Identifiers — Device ID | Treat as Yes pending SDK audit | No | App Functionality, Analytics | Verify the exact identifiers emitted by Clerk, RevenueCat, Sentry, Expo, and Apple receipts using their current privacy manifests and an App Privacy Report. |
| User Content — Audio Data | Yes | No | App Functionality | Microphone recordings sent for speech-to-text when the user chooses voice input. Confirm whether raw audio is retained and for how long. |
| User Content — Other User Content | Yes | No | App Functionality, Product Personalization | AI prompts/replies, conversations, Goals, Projects, Tasks, Highlights, Mind bookmarks, Hive progress, and user-approved connected-service results. |
| Usage Data — Product Interaction | Yes | No | Analytics, App Functionality | Feature events, paywall impressions, navigation/performance spans, and product use needed to operate and improve BeeGreat. |
| Diagnostics — Crash Data | Yes | No | Analytics, App Functionality | Sentry crash and handled-error reporting; production configuration links only the Clerk user ID and redacts direct content. |
| Diagnostics — Performance Data | Yes | No | Analytics, App Functionality | Sentry traces, app-start, stall, frame, and hang performance. |
| Diagnostics — Other Diagnostic Data | Yes | No | Analytics, App Functionality | Sanitized technical context needed to diagnose failures. |
| Other Data | Yes, only when a connection is enabled | No | App Functionality | OAuth connection metadata and user-approved results from ChatGPT, GitHub, Linear, Notion, Google Health, and wallet services that do not fit a more specific type. |

### Explicitly not recommended unless the build changes

- Payment Info: Apple handles payment credentials; BeeGreat receives purchase
  and entitlement state, not card details.
- Precise or Coarse Location: no location feature is identified in 1.0.0.
- Contacts: the app does not upload the address book.
- Browsing History or Search History: saved URLs and focus prompts are covered
  as Other User Content, not a record of general browsing/search activity.
- Photos or Videos: the current mobile input does not import user photos or
  videos. Add the applicable type before shipping any media-upload feature.
- Sensitive Info: use the specific Health and Financial categories above; add
  Sensitive Info if production scope introduces another protected attribute.

### Final privacy evidence to gather

- Export and inspect the submitted archive's privacy manifests.
- Run iOS App Privacy Report through sign-in, purchase/restore, voice, Sentry
  failure handling, every optional connection, account deletion, and support.
- Confirm retention/deletion behavior for raw voice audio, chat content, health
  data, OAuth credentials, connected-service results, wallet data, purchase
  records, and diagnostics.
- Reconcile Apple's labels with the live Privacy Policy and each processor's
  current data-safety documentation. When evidence conflicts with this file,
  update both the labels and this packet before submission.
