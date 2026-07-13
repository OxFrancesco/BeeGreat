import { createFileRoute } from '@tanstack/react-router'

import { ProjectPage } from '~/features/focus/project-page'

export const Route = createFileRoute('/_app/projects/$projectId')({
  component: ProjectRoute,
})

function ProjectRoute() {
  const { projectId } = Route.useParams()
  return <ProjectPage projectId={projectId} />
}
