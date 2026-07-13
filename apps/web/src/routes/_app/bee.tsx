import { createFileRoute } from '@tanstack/react-router'

import { BeeWorkspace } from '~/features/bee/bee-workspace'

export const Route = createFileRoute('/_app/bee')({
  component: BeeWorkspace,
})
