import { createFileRoute } from '@tanstack/react-router'

import { MoodPage } from '~/features/health/health-pages'

export const Route = createFileRoute('/_app/health/')({
  component: MoodPage,
})
