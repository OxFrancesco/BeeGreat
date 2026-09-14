# Personal CRM

My Mind has Bookmarks and CRM tabs on web and mobile. CRM stores personal contacts,
how you know them, email, phone, notes, a follow-up date, and the last-contact date.
Search covers names, context, contact details, and notes. Follow-ups show scheduled
contacts in date order. Archived contacts have their own filter and can be restored.
Dates are calendar dates, not notification schedules. Use Bee's reminder tools when
a notification is needed.

The `crm` chat component shows contact records and opens the same editor as My Mind.
Web and mobile load each record from Convex so edits and archive state update in both
places. Missing or inaccessible contacts show an unavailable state. CLI and iMessage
show the tool-result snapshot as text, including dates, without machine identifiers.

Bee has `list_contacts`, `save_contact`, and `archive_contact` tools. They run through
the existing credential broker and Hive owner lookup. The same Bee tool registration
serves OpenRouter and ChatGPT/Codex, including chat and voice entry points. Find an
exact contact before editing and preserve unspecified fields. Saving an empty string
clears text; null clears a date. The agent must not infer that contact happened.

Convex public functions derive ownership from the authenticated token identifier.
Agent functions resolve the user's Hive owner key. All reads and writes are scoped;
list results paginate and agent searches return at most 30 records. Account deletion
also removes CRM records.

Validation covers create/read/update, date clearing, archive/restore, invalid dates,
anonymous access, cross-owner access, account deletion, and text-channel rendering.
The isolated browser preview uses synthetic data and exercises the real web components.
It does not prove an authenticated full-app chat or a physical mobile-device session.
The backend was deployed to development. Web, mobile, and worker production releases
are separate steps and were not performed as part of this implementation.
