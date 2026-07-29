import { createFileRoute } from '@tanstack/react-router'

import { PublicTapPage } from '~/features/health/tap-actions'

export const Route = createFileRoute('/tap/$publicId')({
  component: OpenTapAction,
})

function OpenTapAction() {
  const { publicId } = Route.useParams()
  return <PublicTapPage publicId={publicId} />
}
