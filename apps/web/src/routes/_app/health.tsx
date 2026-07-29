import { createFileRoute } from '@tanstack/react-router'

import { HealthLayout } from '~/features/health/health-pages'

export const Route = createFileRoute('/_app/health')({
  component: HealthLayout,
  ssr: false,
})
