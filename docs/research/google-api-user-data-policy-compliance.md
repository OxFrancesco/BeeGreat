# Google Workspace connector compliance review

- Date: 2026-08-13
- Status: **not ready to attest for public production**; testing may continue
- Scope: BeeGreat's Google Workspace OAuth request, agent processing, public
  disclosures, retention/deletion, security, and production-verification path
- Sources: current first-party Google policy and product documentation only

This is an engineering and product-policy review, not legal advice or a Google
certification. Google and its assessors make the final verification decision.

## Verdict

Do **not** check “I agree to the Google API Services: User Data Policy” as a
claim of current production compliance yet.

BeeGreat's user-facing productivity use case is permitted in principle. Google
explicitly allows Gmail productivity enhancements, including generative-AI
summaries, and Drive productivity apps that handle files through their user
interface. However, the current implementation does not yet satisfy several
express requirements in the latest Workspace policy: the connection flow lacks
a specific, immediately-pre-consent disclosure; the public privacy policy does
not disclose Google Workspace data or affirm Limited Use; all Workspace scopes
are requested at once rather than incrementally; several requested scopes are
broader than the enabled commands; and the production domain, AI-provider
retention/training guarantees, security assessment, and separate production
Google Cloud project are not ready.

The current Google policy says developers must stop using Workspace services
when they cannot meet the requirements or face a significant risk that they
cannot meet them. Therefore the safe sequence is:

1. close the product, disclosure, scope, and provider-contract gaps below;
2. use a separate **testing** Google Cloud project and named test users for
   simulator development;
3. create a separate production project, verify BeeGreat's owned domain and
   brand, then complete scope verification and the restricted-scope security
   assessment before public launch.

The governing sources are the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
the newer [Google Workspace user data and developer policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy),
and [Google's OAuth production-compliance guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).

## Remediation completed after the audit

The following repository gaps identified below were closed on 2026-08-13. They
improve the product's policy posture but do not replace Google's verification or
the remaining operational work:

- Mobile, web Settings, and the shared CLI/iMessage browser handoff now show an
  immediately-pre-consent, service-by-service Workspace disclosure. The backend
  rejects Google authorization requests that omit the current disclosure
  version or select no service.
- OAuth scopes are assembled from only the services selected by the user.
  `gmail.compose` and the broad Calendar/Drive/editor write scopes were removed;
  Drive, Docs, Sheets, and Slides are now read-only.
- The public Privacy, Support, and Terms pages now describe Workspace data,
  service-provider/AI processing, conversation retention, disconnection,
  deletion, Limited Use, and the prohibition on generalized-model training.
- Google-connected agent turns are forced onto a dedicated OpenRouter route
  that requests `data_collection: deny` and `zdr: true`, and therefore cannot
  silently fall back to the user's ChatGPT/Codex subscription.
- BeeGreat now bakes a Workspace-specific gog safety profile. It blocks Gmail
  sending/deletion, Calendar deletion/sharing/admin commands, Drive/editor
  writes and sharing, and Contacts/Forms mutations. Provider output is excluded
  from error diagnostics.
- Google refresh-token revocation is now preferred during disconnect and account
  deletion, which invalidates the durable grant rather than only the current
  access token.

The still-blocking production items are the owned/verified BeeGreat domain,
separate test and production Google projects, provider contractual evidence,
HSM-equivalent key-management evidence, broader prompt-injection/red-team
evidence, CASA/restricted-scope assessment, and Google's brand/scope
verification. The console attestation therefore remains unchecked.

## What the current policy requires

### Notice and affirmative consent for an agent

Google now expressly applies the Workspace policy to APIs, MCPs, and other
agent tools. Before collecting Workspace data, BeeGreat must show an in-product
disclosure during normal use—not only in Privacy or Terms—that identifies
BeeGreat, says which data it accesses or collects, and explains every use and
transfer. The disclosure must immediately precede an unambiguous affirmative
consent. Google specifically gives granular confirmation of an MCP, tool,
skill, or other agentic-behavior invocation as an example. Navigation away is
not consent, and the disclosure cannot auto-dismiss. BeeGreat must also publish
help documentation explaining how users manage and delete their data
([Workspace policy, “Transparent and accurate notice and control”](https://developers.google.com/workspace/workspace-api-user-data-developer-policy#transparent-and-accurate-notice-and-control)).

A single “Connect Google Workspace” button is therefore not enough by itself
for future autonomous reads or mutations. A direct natural-language request
can be the per-action affirmative act when it is unambiguous, but the product
must pair it with a clear disclosure of what will be read, changed, stored, and
sent to an AI provider. Ambiguous or agent-initiated access needs a separate
confirmation.

### Limited Use and AI processing

Limited Use applies to raw, aggregated, anonymized, and derived data obtained
from both sensitive and restricted Workspace scopes. BeeGreat may use or
transfer it only for the appropriate, visible, user-facing feature and, for a
service-provider transfer, only with the user's consent. Humans may not read it
except with documented consent to specific data or for the narrow security,
legal, and anonymized-internal-operations exceptions
([Workspace Limited Use requirements](https://developers.google.com/workspace/workspace-api-user-data-developer-policy#limited-use-of-user-data)).

Workspace data may not be transferred, sold, or used to create, train, or
improve an ML/AI model beyond that specific user's personalized model and
user-facing use case. Google also prohibits scraping, model-training databases,
permanent copies, and caches retained beyond permitted cache headers. BeeGreat
must publish an affirmative Limited Use statement and ensure every employee,
agent, contractor, successor, AI router, and downstream model provider follows
the policy. Google's [Limited Use FAQ](https://support.google.com/cloud/answer/13463817)
clarifies that data may not train or improve foundational models or be stored
with them.

Consequently, sending a requested Gmail message or Drive file transiently to a
model can fit the policy only when all of these are true:

- it is necessary for the exact user-visible request and the user consents;
- it is not used to train or improve a generalized model;
- the router and downstream provider do not retain it with the model or use it
  for unrelated purposes;
- saved excerpts or summaries are clearly disclosed and remain user-deletable;
- BeeGreat has contractual and technical evidence for those guarantees.

### Security, revocation, and deletion

Google requires encryption in transit and at rest, encrypted OAuth access and
refresh tokens, appropriate key management such as HSM-equivalent controls,
prompt-injection protection (Model Armor or another effective protection), and
CASA controls for restricted scopes. A known or suspected incident involving
stored Google data must be reported promptly to `security@google.com`, before a
public statement. Restricted-scope apps that access or transmit data through a
server are subject to a Google-empanelled security assessment and ongoing
reassessment
([Workspace security requirements](https://developers.google.com/workspace/workspace-api-user-data-developer-policy#maintain-a-secure-operating-environment),
[restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification),
[security assessment](https://support.google.com/cloud/answer/13465431)).

Tokens must be revoked as soon as they are no longer needed and permanently
deleted. Apps must handle revocation/expiry and make user data deletion
available
([OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices),
[OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies)).

## Scope classification and least-privilege review

The source request is
[`GOOGLE_WORKSPACE_SCOPES`](../../packages/backend/convex/beennectorOAuth.ts#L20-L35).
The Google Cloud Console Data Access page remains Google's authoritative current
classifier for every scope. The following classifications are also supported by
Google's current restricted-scope list and API-specific authorization guides.

| Requested scope | Classification | Current access and finding |
| --- | --- | --- |
| `openid`, `email`, `profile` | Non-sensitive identity set | Appropriate to identify the connected account. |
| `gmail.modify` | **Restricted** | Supports reading, drafting, labels, archive, and mailbox changes, but also grants compose/send capability. It is necessary only if mailbox mutations remain a shipped feature. |
| `gmail.compose` | **Restricted** | Redundant because `gmail.modify` already covers the enabled Gmail behavior. Remove it. |
| `calendar` | Sensitive | Allows viewing, editing, sharing, and permanently deleting all accessible calendars. Replace with narrower event/calendar-list/free-busy scopes unless calendar/ACL administration is an intentional, disclosed feature. |
| `drive` | **Restricted** | Allows read, edit, create, and delete across all Drive files. Prefer `drive.file` plus Google Picker for user-selected files. If broad Drive search is indispensable, justify it and remove every unsupported mutation; at minimum consider `drive.readonly` for read-only behavior. |
| `documents` | Sensitive | Current safe profile reads Docs and blocks document writes. Replace with `documents.readonly`; use `drive.file` where file-by-file selection works. |
| `spreadsheets` | Sensitive | Required only because the profile allows a few sheet mutations (add/rename tab and chart changes). If those are not visible, tested features, use `spreadsheets.readonly`. |
| `presentations` | Sensitive | Current safe profile only reads/exports Slides. Replace with `presentations.readonly`. |
| `contacts.readonly` | Sensitive/private Workspace data | Correct read-only shape if Contacts search/list is a visible shipped feature; otherwise request later in context. |
| `tasks` | Sensitive/private Workspace data | Enables create/edit/organize/delete, while the profile blocks delete. Keep only if task mutations are a visible shipped feature; otherwise use `tasks.readonly` or defer. |
| `forms.body.readonly` | Sensitive/high-risk Workspace data | Correct for reading form content if Forms is shipped, but the current connection description omits Forms. Request in context. |
| `forms.responses.readonly` | Sensitive/high-risk Workspace data | Form responses can contain especially sensitive third-party data. Keep only for a clearly disclosed, user-directed feature and request in context. |

Primary scope sources: [restricted scopes](https://support.google.com/cloud/answer/13464325),
[all Google API scope descriptions](https://developers.google.com/identity/protocols/oauth2/scopes),
[Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth),
[Docs scopes](https://developers.google.com/workspace/docs/api/auth),
[Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes),
[Slides scopes](https://developers.google.com/workspace/slides/api/scopes), and
[sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).

Google requires the narrowest implemented scopes and incremental authorization
where possible; it explicitly rejects “future proofing” access
([User Data Policy, “Request the minimum relevant permissions”](https://developers.google.com/terms/api-services-user-data-policy#request_the_minimum_relevant_permissions),
[OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)).
The current implementation instead requests all 15 entries in one authorization
request and asks for offline access
([authorization request](../../packages/backend/convex/beennectorOAuth.ts#L150-L163)).

## BeeGreat implementation audit

### Controls already pointing in the right direction

- Tokens are encrypted server-side, a refreshed access token is passed only to
  one sandbox command through its environment, and output redacts the token
  ([broker and command execution](../../packages/agent/src/shared/google-workspace-subagent.ts#L112-L151)).
- OAuth uses state, PKCE, HTTPS callbacks, encrypted credentials, offline-token
  refresh handling, and provider-specific revocation.
- Disconnect best-effort revokes upstream access before deleting the connection
  ([disconnect action](../../packages/backend/convex/beennectorAuthActions.ts#L208-L237));
  account deletion also loops over Google and the other Beennector credentials
  and revokes them
  ([account cleanup](../../packages/backend/convex/accountDeletionActions.ts#L268-L286)).
- The agent-safe profile blocks Gmail sends and deletes, Drive deletes and
  sharing changes, authentication writes, and many destructive editor actions
  ([profile](../../resources/gogcli/safety-profiles/agent-safe.yaml)).
- Google results are wrapped as untrusted content, tokens are excluded from the
  model, and the specialist is instructed not to follow instructions contained
  in Google data
  ([specialist guardrails](../../packages/agent/src/shared/google-workspace-subagent.ts#L36-L59)).

These are helpful controls, but they do not by themselves establish compliance
or replace Google's assessment.

### Blocking gaps

1. **The in-product connection disclosure is incomplete.** The card only says
   “Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts, and Tasks,” omitting
   Forms despite requesting two Forms scopes, and it does not explain content
   collection, AI-provider transfer, possible conversation storage, retention,
   deletion, or Limited Use
   ([catalog copy](../../packages/backend/convex/beennectors.ts#L20-L38),
   [mobile connection UI](../../apps/mobile/src/components/beennectors/beennectors-settings.tsx#L115-L170)).
   It does not immediately precede a separate affirmative Google-data consent.
2. **The public privacy policy does not disclose Google Workspace.** Its
   optional-connection list names Google Health but not Google Workspace; its AI
   section describes BeeGreat context generally, not Gmail/Drive/Calendar data;
   and the policy contains no required Limited Use or no-generalized-AI-training
   affirmation
   ([current privacy policy](../../apps/beedocs/src/pages/privacy.astro#L51-L69),
   [AI disclosure](../../apps/beedocs/src/pages/privacy.astro#L121-L134)).
3. **The policy and implementation disagree on deletion.** Code revokes the
   Google Beennector during account cleanup, while the public policy says it
   revokes Google Health, GitHub, Linear, and Notion, omitting Google Workspace
   ([published deletion text](../../apps/beedocs/src/pages/privacy.astro#L177-L187)).
4. **Scopes are neither incremental nor demonstrably minimal.** `gmail.compose`
   is redundant; Docs and Slides request write/delete-capable scopes despite
   read-only commands; and full Calendar/Drive access is materially broader than
   much of the described experience.
5. **Safety-profile claims need correction and enforcement tests.** The prose
   says sharing changes are blocked, but `calendar.acl` and `calendar.alias` are
   enabled, as is `create-calendar`
   ([calendar profile](../../resources/gogcli/safety-profiles/agent-safe.yaml#L53-L76)).
   The effective subcommands must be audited so ACL mutation cannot bypass the
   stated boundary.
6. **AI provider compliance is not evidenced.** The specialist's Google output
   is model-facing, and Bee can use OpenRouter/downstream models. The repository
   contains no verified zero-training/no-retention configuration or contractual
   record covering every downstream provider. This must be resolved before
   transferring Workspace data.
7. **Prompt-injection protection is promising but unproven.** Untrusted-content
   markers and instructions exist, but the new policy requires effective prompt-
   injection protection. Document the control, test adversarial Gmail/Docs/Forms
   payloads, and include it in the CASA evidence package.
8. **The production identity/domain is not ready.** Google requires the homepage,
   privacy policy, terms, and callback domains to be owned and verifiable in
   Search Console. A shared `pages.dev` hostname is not a substitute for an owned
   BeeGreat domain, and `beegreat.app` currently needs working DNS/hosting
   ([Google production requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#only-use-domains-you-own)).
9. **Testing and production must be separate projects.** Google requires
   separate Cloud projects; a production project cannot carry developer-only
   callbacks or origins
   ([production-compliance guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance#use-separate-projects-for-testing-and-production)).
10. **Restricted-scope review is not complete.** Gmail and Drive plus server-side
    processing trigger restricted-scope verification and a security assessment.
    BeeGreat also needs brand verification, per-scope justifications, a complete
    demo video, incident procedures, and annual reassessment.

## Testing versus public production

A testing project can authorize explicitly listed test users without completing
public verification. It will show an unverified/test warning, is capped at 100
test users, and grants including offline refresh tokens expire after seven days
when non-identity scopes are requested
([Manage App Audience](https://support.google.com/cloud/answer/15549945),
[verification exceptions](https://support.google.com/cloud/answer/13464323)).

Testing status is not a waiver from the User Data Policy. It is appropriate for
the simulator only after the developer has truthfully accepted the policy and
limits use to controlled development. Public production must complete brand,
sensitive-scope, and restricted-scope verification before requesting those
scopes. Google's current estimates are roughly 2–3 business days for brand
verification, 10 business days for sensitive scopes, and up to six weeks for
restricted scopes, but are not guarantees
([OAuth verification FAQ](https://support.google.com/cloud/answer/13463817)).

## Concrete compliance checklist

Do not attest or transmit real Workspace content until the first group is done.

### Product and policy blockers

- [ ] Add a Google-specific, in-product disclosure immediately before consent.
  Name Gmail, Calendar, Drive, Docs, Sheets, Slides, Contacts, Tasks, **and
  Forms**; describe reads/writes, encrypted credential storage, model/provider
  transfer, conversation storage, retention, disconnection, and deletion.
- [ ] Add granular confirmation for each agentic Google operation. An explicit,
  unambiguous user command may count; confirm ambiguous reads and every mutation.
- [ ] Update Privacy and Support with a dedicated Google Workspace section,
  exact data categories, purposes, providers, retention/deletion, user controls,
  and the affirmative Limited Use statement.
- [ ] Explicitly state and technically prohibit use of raw or derived Workspace
  data to develop, improve, or train non-personalized/generalized AI/ML models.
- [ ] Ensure Google-derived chat excerpts/summaries are visible and deletable and
  that account deletion removes them from active systems and backup lifecycle.
- [ ] Obtain and retain evidence that OpenRouter and every downstream provider
  use Workspace data only for the user-directed feature, with no model training
  and no prohibited retention. Configure routing so a noncompliant provider
  cannot receive Google data.

### Scope and command blockers

- [ ] Remove `gmail.compose` while retaining `gmail.modify`, or redesign around
  narrower Gmail scopes if mailbox mutations are not essential.
- [ ] Replace full `calendar` with the minimum event, list, and free/busy scopes;
  disable ACL/alias/calendar-creation commands unless explicitly shipped and
  disclosed.
- [ ] Decide whether broad Drive search is essential. Prefer `drive.file` plus
  Picker; otherwise justify the minimum restricted Drive scope.
- [ ] Change Docs and Slides to read-only scopes while writes remain blocked.
- [ ] Review Sheets/Tasks mutations and remove or downscope any unshipped feature.
- [ ] Request Contacts, Tasks, and Forms access incrementally at first use rather
  than in the initial Workspace connection.
- [ ] Add automated authorization tests that the requested scopes exactly match
  the allowed command graph and that denied partial grants disable only the
  affected feature.

### Security and operations blockers

- [ ] Document encryption algorithms, key access, rotation, isolation, and an
  HSM/equivalent-strength key-management control; do not rely on a lone app env
  key without an assessed key-management story.
- [ ] Red-team prompt injection in Gmail, Drive, Docs, Sheets, Slides, Forms,
  Contacts, Calendar, and Tasks; record protection and regression evidence.
- [ ] Confirm Google content never enters Sentry, application logs, sandbox
  persistence, analytics, or unrelated memory/indexing.
- [ ] Add a Google-specific incident runbook: containment, deletion, evidence,
  Google notification at `security@google.com`, and notification ordering.
- [ ] Complete CASA and the Google-empanelled restricted-scope assessment before
  public server-side Gmail/Drive processing; schedule annual reassessment.

### Google Cloud and launch blockers

- [ ] Restore an owned BeeGreat domain, host homepage/Privacy/Terms on it, and
  verify every associated domain in Search Console.
- [ ] Create separate testing and production Google Cloud projects and credentials;
  keep dev callbacks out of production.
- [ ] Configure an External testing audience with named test users for simulator
  validation; expect seven-day token expiry.
- [ ] Declare only final scopes in Data Access and record Google's classifications.
- [ ] Complete brand verification, then sensitive/restricted scope verification
  with one justification per scope and an English demo showing every requested
  permission in use.
- [ ] Verify disconnect and account deletion revoke Google tokens and permanently
  erase credentials even when revocation retries fail; test expired and revoked
  refresh-token recovery.
- [ ] Monitor Google policy and project-contact email continuously and repeat
  verification/security assessment when required.

## Decision for the current console checkbox

The checkbox is a developer attestation to an ongoing policy, not merely a
technical step to create credentials. Based on the repository and public policy
review above, BeeGreat cannot currently make an unqualified production-
compliance claim. The developer can proceed only after either:

- completing the blockers before accepting; or
- consciously limiting the project to controlled testing while immediately
  remediating the disclosure/scope/provider gaps and not publishing or processing
  real users' Workspace data.

The least risky recommendation is to leave the checkbox unchecked until the
product and privacy changes are implemented, then accept for a clearly labeled
testing project and continue simulator work. Production must remain blocked
until verification and the security assessment are complete.
