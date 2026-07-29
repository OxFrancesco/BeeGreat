import { createFileRoute } from '@tanstack/react-router'

import { TapActionsPage } from '~/features/health/tap-actions'

export const Route = createFileRoute('/_app/health/tap-actions')({
  component: TapActionsPage,
})
