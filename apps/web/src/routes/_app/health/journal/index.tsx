import { createFileRoute } from '@tanstack/react-router'

import { JournalPage } from '~/features/health/journal-pages'

export const Route = createFileRoute('/_app/health/journal/')({
  component: JournalPage,
})
