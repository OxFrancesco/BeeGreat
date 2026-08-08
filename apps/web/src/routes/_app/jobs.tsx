import { createFileRoute } from '@tanstack/react-router'

import { JobsPage } from '~/features/jobs/jobs-page'

export const Route = createFileRoute('/_app/jobs')({
  component: JobsPage,
})
