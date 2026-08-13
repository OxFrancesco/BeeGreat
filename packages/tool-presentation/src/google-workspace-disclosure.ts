export const GOOGLE_WORKSPACE_DISCLOSURE_VERSION = '2026-08-13'

export type GoogleWorkspaceService =
  | 'mail'
  | 'calendar'
  | 'drive'
  | 'contacts'
  | 'tasks'
  | 'forms'

export const GOOGLE_WORKSPACE_SERVICES: ReadonlyArray<{
  id: GoogleWorkspaceService
  name: string
  access: string
}> = [
  {
    id: 'mail',
    name: 'Gmail',
    access: 'Read mail, organize it, and prepare drafts. Bee cannot send email.',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    access: 'Read, create, and update events. Bee cannot delete events or manage sharing.',
  },
  {
    id: 'drive',
    name: 'Drive & editors',
    access: 'Search and read Drive, Docs, Sheets, and Slides. Bee cannot edit or share files.',
  },
  {
    id: 'contacts',
    name: 'Contacts',
    access: 'Search and read contacts. Bee cannot change them.',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    access: 'Read, create, and update Tasks. Bee cannot delete them.',
  },
  {
    id: 'forms',
    name: 'Forms',
    access: 'Read forms and responses. Bee cannot change forms.',
  },
]

export const GOOGLE_WORKSPACE_DISCLOSURE =
  'BeeGreat accesses only the services you select and only when you directly ask Bee. Results are processed by BeeGreat, Convex, Cloudflare, and AI providers configured for no training and zero retention to answer your request. A result or summary can be saved in your BeeGreat conversation until you delete it or your account. Credentials are encrypted. Disconnecting revokes future access and removes them.'
