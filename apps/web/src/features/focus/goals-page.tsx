import { api } from '@beegreat/backend/convex/_generated/api'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { useBeeAgentContext } from '../bee/bee-agent-context'
import { HealthSummaryCard } from '../health/health-pages'
import {
  CombProgress,
  DeleteModal,
  EntityMenu,
  FocusPage,
  InlineCreate,
  PageHeader,
  RenameModal,
} from './focus-ui'

import type { FunctionReturnType } from 'convex/server'

const MAX_GOALS = 3
type Goal = FunctionReturnType<typeof api.goals.list>[number]

export function GoalsPage() {
  const goals = useQuery(api.goals.list)
  const agent = useBeeAgentContext()
  const createGoal = useMutation(api.goals.create)
  const updateGoal = useMutation(api.goals.update)
  const removeGoal = useMutation(api.goals.remove)
  const [renaming, setRenaming] = useState<Goal>()
  const [deleting, setDeleting] = useState<Goal>()

  return (
    <FocusPage>
      <PageHeader
        title="Goals"
        actions={
          <div className="goals-header-actions">
            <div className="page-currency" aria-label="Hive balances">
              <span>◇ {agent.currentFirstFocus?.hive.honeyBalance ?? '–'}</span>
              <span>
                ⬡ {agent.currentFirstFocus?.hive.honeycombScore ?? '–'}
              </span>
              <span>
                ◆ {agent.currentFirstFocus?.hive.royalJellyBalance ?? '–'}
              </span>
            </div>
            {goals ? (
              <span className="capacity-pill">
                {goals.length}/{MAX_GOALS} focus slots
              </span>
            ) : null}
          </div>
        }
      />

      <HealthSummaryCard />

      {goals === undefined ? (
        <FocusLoading label="Gathering your goals…" />
      ) : (
        <section
          className="focus-stack focus-stack--slots"
          aria-label="Active goals"
        >
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onRename={() => setRenaming(goal)}
              onDelete={() => setDeleting(goal)}
            />
          ))}
          {goals.length < MAX_GOALS ? (
            <InlineCreate
              label="New goal"
              onCreate={(title) => createGoal({ title })}
            />
          ) : (
            <div className="focus-limit-note">
              Three active Goals keeps the Hive focused. Complete or remove one
              before adding another.
            </div>
          )}
        </section>
      )}

      {renaming ? (
        <RenameModal
          noun="goal"
          initialValue={renaming.title}
          onClose={() => setRenaming(undefined)}
          onSave={(title) => updateGoal({ goalId: renaming.id, title })}
        />
      ) : null}
      {deleting ? (
        <DeleteModal
          noun="goal"
          name={deleting.title}
          detail="and all of its projects and tasks will be gone for good."
          onClose={() => setDeleting(undefined)}
          onDelete={() => removeGoal({ goalId: deleting.id })}
        />
      ) : null}
    </FocusPage>
  )
}

function GoalCard({
  goal,
  onRename,
  onDelete,
}: {
  goal: Goal
  onRename: () => void
  onDelete: () => void
}) {
  const total = goal.openTasks + goal.doneTasks
  const progress = total === 0 ? 0 : goal.doneTasks / total
  const meta =
    total === 0
      ? 'No tasks yet'
      : goal.openTasks === 0
        ? 'All tasks done'
        : `${goal.openTasks} ${goal.openTasks === 1 ? 'task' : 'tasks'} left`
  return (
    <article className="focus-card goal-card">
      <Link
        className="focus-card__link"
        to="/goals/$goalId"
        params={{ goalId: goal.id }}
        aria-label={`Open goal ${goal.title}`}
      >
        <CombProgress value={progress} label={`${goal.title} progress`} />
        <div className="focus-card__copy">
          <h2>{goal.title}</h2>
          <p>{goal.finalGoal || meta}</p>
          {goal.finalGoal ? <small>{meta}</small> : null}
        </div>
        <span className="focus-card__arrow" aria-hidden="true">
          →
        </span>
      </Link>
      <EntityMenu label={goal.title} onRename={onRename} onDelete={onDelete} />
    </article>
  )
}

export function FocusLoading({ label }: { label: string }) {
  return (
    <div className="focus-loading" aria-live="polite">
      <span />
      {label}
    </div>
  )
}
