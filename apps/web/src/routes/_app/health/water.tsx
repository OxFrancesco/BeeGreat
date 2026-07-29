import { createFileRoute } from '@tanstack/react-router'

import { WaterPage } from '~/features/health/health-pages'

export const Route = createFileRoute('/_app/health/water')({
  component: WaterPage,
})
