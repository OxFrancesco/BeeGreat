package com.beegreat.contract

// Port of packages/tool-presentation/src/google-workspace-disclosure.ts. The
// version string is what the backend records as the disclosure the user saw.

const val GOOGLE_WORKSPACE_DISCLOSURE_VERSION = "2026-08-13"

data class GoogleWorkspaceService(val id: String, val name: String, val access: String)

val GOOGLE_WORKSPACE_SERVICES =
  listOf(
    GoogleWorkspaceService("mail", "Gmail", "Read mail, organize it, and prepare drafts. Bee cannot send email."),
    GoogleWorkspaceService("calendar", "Calendar", "Read, create, and update events. Bee cannot delete events or manage sharing."),
    GoogleWorkspaceService("drive", "Drive & editors", "Search and read Drive, Docs, Sheets, and Slides. Bee cannot edit or share files."),
    GoogleWorkspaceService("contacts", "Contacts", "Search and read contacts. Bee cannot change them."),
    GoogleWorkspaceService("tasks", "Tasks", "Read, create, and update Tasks. Bee cannot delete them."),
    GoogleWorkspaceService("forms", "Forms", "Read forms and responses. Bee cannot change forms."),
  )

const val GOOGLE_WORKSPACE_DISCLOSURE =
  "BeeGreat accesses only the services you select and only when you directly ask Bee. Results are processed by BeeGreat, Convex, Cloudflare, and AI providers configured for no training and zero retention to answer your request. A result or summary can be saved in your BeeGreat conversation until you delete it or your account. Credentials are encrypted. Disconnecting revokes future access and removes them."
