import { createFileRoute } from '@tanstack/react-router'

import { JournalEditorPage } from '~/features/health/journal-pages'

export const Route = createFileRoute('/_app/health/journal/$entryId')({
  component: JournalEntryRoute,
})

function JournalEntryRoute() {
  const { entryId } = Route.useParams()
  return <JournalEditorPage entryId={entryId} />
}
