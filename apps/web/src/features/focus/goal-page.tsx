import { api } from '@beegreat/backend/convex/_generated/api'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import {
  CombProgress,
  DeleteModal,
  EntityMenu,
  FocusPage,
  InlineCreate,
  PageHeader,
  RenameModal,
} from './focus-ui'
import { FocusLoading } from './goals-page'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'

type Goal = NonNullable<FunctionReturnType<typeof api.goals.get>>
type Project = Goal['projects'][number]

export function GoalPage({ goalId }: { goalId: string }) {
  // SAFETY: the route param carries the `goals` document id this page was
  // linked with; Convex validates the id shape and the page renders the
  // missing state when a stale or foreign id resolves to null.
  const id = goalId as Id<'goals'>
  const goal = useQuery(api.goals.get, { goalId: id })
  const createProject = useMutation(api.projects.create)
  const updateGoal = useMutation(api.goals.update)
  const removeGoal = useMutation(api.goals.remove)
  const updateProject = useMutation(api.projects.update)
  const removeProject = useMutation(api.projects.remove)
  const navigate = useNavigate()
  const [renameGoal, setRenameGoal] = useState(false)
  const [deleteGoal, setDeleteGoal] = useState(false)
  const [renameProject, setRenameProject] = useState<Project>()
  const [deleteProject, setDeleteProject] = useState<Project>()

  if (goal === undefined) return <FocusLoading label="Opening this Goal…" />
  if (goal === null) {
    return <MissingFocus title="This Goal is gone." back="/goals" />
  }

  return (
    <FocusPage>
      <PageHeader
        title={goal.title}
        eyebrow="Goal"
        back={
          <Link className="back-link" to="/goals" aria-label="Back to Goals">
            ←
          </Link>
        }
        actions={
          <EntityMenu
            label={goal.title}
            onRename={() => setRenameGoal(true)}
            onDelete={() => setDeleteGoal(true)}
          />
        }
      />
      {goal.finalGoal ? <p className="goal-outcome">{goal.finalGoal}</p> : null}

      <section className="focus-section">
        <div className="focus-section__heading">
          <div>
            <p className="utility-label">Projects</p>
            <h2>Ways this Goal moves</h2>
          </div>
          <span>{goal.projects.length}</span>
        </div>
        <div className="focus-stack">
          {goal.projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={() => setRenameProject(project)}
              onDelete={() => setDeleteProject(project)}
            />
          ))}
          <InlineCreate
            label="New project"
            onCreate={async (title) => {
              await createProject({ goalId: id, title })
            }}
          />
        </div>
      </section>

      {renameGoal ? (
        <RenameModal
          noun="goal"
          initialValue={goal.title}
          onClose={() => setRenameGoal(false)}
          onSave={async (title) => {
            await updateGoal({ goalId: id, title })
          }}
        />
      ) : null}
      {deleteGoal ? (
        <DeleteModal
          noun="goal"
          name={goal.title}
          detail="and all of its projects and tasks will be gone for good."
          onClose={() => setDeleteGoal(false)}
          onDelete={async () => {
            await removeGoal({ goalId: id })
            await navigate({ to: '/goals' })
          }}
        />
      ) : null}
      {renameProject ? (
        <RenameModal
          noun="project"
          initialValue={renameProject.title}
          onClose={() => setRenameProject(undefined)}
          onSave={async (title) => {
            await updateProject({ projectId: renameProject.id, title })
          }}
        />
      ) : null}
      {deleteProject ? (
        <DeleteModal
          noun="project"
          name={deleteProject.title}
          detail="and all of its tasks will be gone for good."
          onClose={() => setDeleteProject(undefined)}
          onDelete={async () => {
            await removeProject({ projectId: deleteProject.id })
          }}
        />
      ) : null}
    </FocusPage>
  )
}

function ProjectCard({
  project,
  onRename,
  onDelete,
}: {
  project: Project
  onRename: () => void
  onDelete: () => void
}) {
  const progress =
    project.totalTasks === 0 ? 0 : project.doneTasks / project.totalTasks
  return (
    <article className="focus-card project-card">
      <Link
        className="focus-card__link"
        to="/projects/$projectId"
        params={{ projectId: project.id }}
      >
        <CombProgress value={progress} label={`${project.title} progress`} />
        <div className="focus-card__copy">
          <h2>{project.title}</h2>
          <p>
            {project.totalTasks === 0
              ? 'No tasks yet'
              : `${project.doneTasks} of ${project.totalTasks} tasks done`}
          </p>
        </div>
        <span className="focus-card__arrow" aria-hidden="true">
          →
        </span>
      </Link>
      <EntityMenu
        label={project.title}
        onRename={onRename}
        onDelete={onDelete}
      />
    </article>
  )
}

export function MissingFocus({ title, back }: { title: string; back: string }) {
  return (
    <main className="missing-focus">
      <div className="missing-focus__comb">⬡</div>
      <h1>{title}</h1>
      <a className="button button--primary" href={back}>
        Return to Goals
      </a>
    </main>
  )
}
