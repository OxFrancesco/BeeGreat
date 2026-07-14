import { createFileRoute } from '@tanstack/react-router'

import { GoalPage } from '~/features/focus/goal-page'

export const Route = createFileRoute('/_app/goals/$goalId')({
  component: GoalRoute,
})

function GoalRoute() {
  const { goalId } = Route.useParams()
  return <GoalPage goalId={goalId} />
}
