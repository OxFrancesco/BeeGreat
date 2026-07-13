import { api } from '@beegreat/backend/convex/_generated/api'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'

import {
  DeleteModal,
  EntityMenu,
  FocusPage,
  InlineCreate,
  Modal,
  PageHeader,
  RenameModal,
} from './focus-ui'
import {
  buildTaskTree,
  endOfDayIn,
  formatProjectDue,
  formatTaskDue,
  upcomingQuarters,
} from './focus-utils'
import { MissingFocus } from './goal-page'
import { FocusLoading } from './goals-page'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'

type Task = FunctionReturnType<typeof api.tasks.listByProject>[number]

export function ProjectPage({ projectId }: { projectId: string }) {
  const id = projectId as Id<'projects'>
  const project = useQuery(api.projects.get, { projectId: id })
  const tasks = useQuery(api.tasks.listByProject, { projectId: id })
  const createTask = useMutation(api.tasks.create)
  const toggleTask = useMutation(api.tasks.toggle)
  const updateTask = useMutation(api.tasks.update)
  const removeTask = useMutation(api.tasks.remove)
  const setTaskDue = useMutation(api.tasks.setDueDate)
  const setProjectDue = useMutation(api.projects.setDue)
  const updateProject = useMutation(api.projects.update)
  const removeProject = useMutation(api.projects.remove)
  const navigate = useNavigate()
  const tree = useMemo(() => buildTaskTree(tasks ?? []), [tasks])
  const [subtaskTarget, setSubtaskTarget] = useState<string>()
  const [renamingTask, setRenamingTask] = useState<Task>()
  const [deletingTask, setDeletingTask] = useState<Task>()
  const [datingTask, setDatingTask] = useState<Task>()
  const [renamingProject, setRenamingProject] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [datingProject, setDatingProject] = useState(false)

  if (project === undefined || tasks === undefined) {
    return <FocusLoading label="Opening this Project…" />
  }
  if (project === null) {
    return <MissingFocus title="This Project is gone." back="/goals" />
  }

  return (
    <FocusPage>
      <PageHeader
        title={project.title}
        eyebrow={
          project.goalTitle ? `Project · ${project.goalTitle}` : 'Project'
        }
        back={
          <Link
            className="back-link"
            to="/goals/$goalId"
            params={{ goalId: project.goalId }}
            aria-label="Back to Goal"
          >
            ←
          </Link>
        }
        actions={
          <EntityMenu
            label={project.title}
            onRename={() => setRenamingProject(true)}
            onDue={() => setDatingProject(true)}
            onDelete={() => setDeletingProject(true)}
          />
        }
      />

      <button
        className="project-due"
        type="button"
        onClick={() => setDatingProject(true)}
      >
        <span aria-hidden="true">◷</span>
        {project.due
          ? `Target: ${formatProjectDue(project.due)}`
          : 'Set a target date (quarter or year)'}
      </button>

      <section className="task-section" aria-label="Open tasks">
        {tree.open.map(({ task, subtasks }) => (
          <div className="task-family" key={task.id}>
            <TaskRow
              task={task}
              onToggle={() => toggleTask({ taskId: task.id })}
              onRename={() => setRenamingTask(task)}
              onDue={() => setDatingTask(task)}
              onDelete={() => setDeletingTask(task)}
              onAddSubtask={() =>
                setSubtaskTarget((current) =>
                  current === task.id ? undefined : task.id,
                )
              }
            />
            {subtasks.map((subtask) => (
              <TaskRow
                key={subtask.id}
                task={subtask}
                subtask
                onToggle={() => toggleTask({ taskId: subtask.id })}
                onRename={() => setRenamingTask(subtask)}
                onDue={() => setDatingTask(subtask)}
                onDelete={() => setDeletingTask(subtask)}
              />
            ))}
            {subtaskTarget === task.id ? (
              <div className="subtask-create">
                <InlineCreate
                  autoFocus
                  compact
                  label="New subtask"
                  onCancel={() => setSubtaskTarget(undefined)}
                  onCreate={(title) =>
                    createTask({
                      projectId: id,
                      parentTaskId: task.id,
                      title,
                    })
                  }
                />
              </div>
            ) : null}
          </div>
        ))}
        <InlineCreate
          label="New task"
          onCreate={(title) => createTask({ projectId: id, title })}
        />
      </section>

      {tree.done.length > 0 ? (
        <section
          className="task-section task-section--done"
          aria-label="Completed tasks"
        >
          <div className="task-section__heading">
            <span>Done</span>
            <strong>{tree.done.length}</strong>
          </div>
          {tree.done.map(({ task, subtasks }) => (
            <div className="task-family" key={task.id}>
              <TaskRow
                task={task}
                onToggle={() => toggleTask({ taskId: task.id })}
                onRename={() => setRenamingTask(task)}
                onDue={() => setDatingTask(task)}
                onDelete={() => setDeletingTask(task)}
              />
              {subtasks.map((subtask) => (
                <TaskRow
                  key={subtask.id}
                  task={subtask}
                  subtask
                  onToggle={() => toggleTask({ taskId: subtask.id })}
                  onRename={() => setRenamingTask(subtask)}
                  onDue={() => setDatingTask(subtask)}
                  onDelete={() => setDeletingTask(subtask)}
                />
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {renamingTask ? (
        <RenameModal
          noun="task"
          initialValue={renamingTask.title}
          onClose={() => setRenamingTask(undefined)}
          onSave={(title) => updateTask({ taskId: renamingTask.id, title })}
        />
      ) : null}
      {deletingTask ? (
        <DeleteModal
          noun="task"
          name={deletingTask.title}
          detail="and its subtasks will be removed."
          onClose={() => setDeletingTask(undefined)}
          onDelete={() => removeTask({ taskId: deletingTask.id })}
        />
      ) : null}
      {datingTask ? (
        <TaskDueModal
          task={datingTask}
          onClose={() => setDatingTask(undefined)}
          onSave={(dueDate) => setTaskDue({ taskId: datingTask.id, dueDate })}
        />
      ) : null}
      {renamingProject ? (
        <RenameModal
          noun="project"
          initialValue={project.title}
          onClose={() => setRenamingProject(false)}
          onSave={(title) => updateProject({ projectId: id, title })}
        />
      ) : null}
      {deletingProject ? (
        <DeleteModal
          noun="project"
          name={project.title}
          detail="and all of its tasks will be gone for good."
          onClose={() => setDeletingProject(false)}
          onDelete={async () => {
            await removeProject({ projectId: id })
            await navigate({
              to: '/goals/$goalId',
              params: { goalId: project.goalId },
            })
          }}
        />
      ) : null}
      {datingProject ? (
        <ProjectDueModal
          hasDue={Boolean(project.due)}
          onClose={() => setDatingProject(false)}
          onSave={(due) => setProjectDue({ projectId: id, due })}
        />
      ) : null}
    </FocusPage>
  )
}

function TaskRow({
  task,
  subtask = false,
  onToggle,
  onRename,
  onDue,
  onDelete,
  onAddSubtask,
}: {
  task: Task
  subtask?: boolean
  onToggle: () => Promise<unknown>
  onRename: () => void
  onDue: () => void
  onDelete: () => void
  onAddSubtask?: () => void
}) {
  const done = task.status === 'done'
  const due = formatTaskDue(task.dueDate)
  return (
    <article
      className={`task-row${subtask ? ' is-subtask' : ''}${done ? ' is-done' : ''}`}
    >
      <button
        className="task-toggle"
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
        onClick={() => void onToggle()}
      >
        {done ? '✓' : ''}
      </button>
      <div className="task-row__copy">
        <strong>{task.title}</strong>
        {due ? <small>Due {due}</small> : null}
      </div>
      {onAddSubtask && !done ? (
        <button className="subtask-button" type="button" onClick={onAddSubtask}>
          ＋ Subtask
        </button>
      ) : null}
      <EntityMenu
        label={task.title}
        onRename={onRename}
        onDue={onDue}
        onDelete={onDelete}
      />
    </article>
  )
}

function TaskDueModal({
  task,
  onClose,
  onSave,
}: {
  task: Task
  onClose: () => void
  onSave: (dueDate: number | null) => Promise<unknown>
}) {
  const choices = [
    { label: 'Today', value: endOfDayIn(0) },
    { label: 'Tomorrow', value: endOfDayIn(1) },
    { label: 'Next week', value: endOfDayIn(7) },
    { label: 'In two weeks', value: endOfDayIn(14) },
    ...(task.dueDate !== null
      ? [{ label: 'Remove due date', value: null, danger: true }]
      : []),
  ]
  return (
    <AsyncChoiceModal
      title="Due date"
      description={`When is “${task.title}” due?`}
      choices={choices}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function ProjectDueModal({
  hasDue,
  onClose,
  onSave,
}: {
  hasDue: boolean
  onClose: () => void
  onSave: (due: { year: number; quarter?: number } | null) => Promise<unknown>
}) {
  const year = new Date().getFullYear()
  const choices = [
    ...upcomingQuarters().map((due) => ({
      label: formatProjectDue(due)!,
      due,
    })),
    { label: String(year), due: { year } },
    { label: String(year + 1), due: { year: year + 1 } },
    ...(hasDue ? [{ label: 'Remove target', due: null, danger: true }] : []),
  ]
  return (
    <AsyncChoiceModal
      title="Target date"
      description="When should this Project land?"
      choices={choices.map((choice) => ({
        label: choice.label,
        value: choice.due,
        danger: 'danger' in choice ? choice.danger : undefined,
      }))}
      grid
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function AsyncChoiceModal<T>({
  title,
  description,
  choices,
  grid = false,
  onClose,
  onSave,
}: {
  title: string
  description: string
  choices: Array<{
    label: string
    value: T
    danger?: boolean
  }>
  grid?: boolean
  onClose: () => void
  onSave: (value: T) => Promise<unknown>
}) {
  const [working, setWorking] = useState<string>()
  const [error, setError] = useState<string>()

  async function choose(label: string, value: T) {
    if (working) return
    setWorking(label)
    setError(undefined)
    try {
      await onSave(value)
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'This date could not be saved.',
      )
    } finally {
      setWorking(undefined)
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className={`choice-list${grid ? ' choice-list--grid' : ''}`}>
        {choices.map((choice) => (
          <button
            className={choice.danger ? 'is-danger' : undefined}
            type="button"
            key={choice.label}
            disabled={Boolean(working)}
            onClick={() => void choose(choice.label, choice.value)}
          >
            {working === choice.label ? 'Saving…' : choice.label}
            {!grid && !choice.danger ? <span>→</span> : null}
          </button>
        ))}
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}
