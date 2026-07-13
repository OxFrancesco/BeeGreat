export type TaskLike = {
  id: string
  parentTaskId: string | null
  status: 'todo' | 'done'
}

export function buildTaskTree<T extends TaskLike>(tasks: Array<T>) {
  const parents = tasks.filter((task) => task.parentTaskId === null)
  const byParent = new Map<string, Array<T>>()
  for (const task of tasks) {
    if (task.parentTaskId === null) continue
    const siblings = byParent.get(task.parentTaskId) ?? []
    siblings.push(task)
    byParent.set(task.parentTaskId, siblings)
  }
  const nodes = parents.map((task) => ({
    task,
    subtasks: byParent.get(task.id) ?? [],
  }))
  return {
    open: nodes.filter(({ task }) => task.status === 'todo'),
    done: nodes.filter(({ task }) => task.status === 'done'),
  }
}

export function endOfDayIn(days: number, from = new Date()) {
  const date = new Date(from)
  date.setDate(date.getDate() + days)
  date.setHours(23, 59, 59, 999)
  return date.getTime()
}

export type ProjectDue = { year: number; quarter?: number } | null

export function formatProjectDue(due: ProjectDue) {
  if (!due) return null
  return due.quarter ? `Q${due.quarter} ${due.year}` : `${due.year}`
}

export function upcomingQuarters(from = new Date()) {
  let year = from.getFullYear()
  let quarter = Math.floor(from.getMonth() / 3) + 1
  return Array.from({ length: 4 }, () => {
    const entry = { year, quarter }
    quarter += 1
    if (quarter > 4) {
      quarter = 1
      year += 1
    }
    return entry
  })
}

export function formatTaskDue(timestamp: number | null) {
  if (timestamp === null) return null
  const date = new Date(timestamp)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
