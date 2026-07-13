import { api } from '@beegreat/backend/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import { FirstFocusPreviewCard } from './first-focus-preview'
import type { ReactNode } from 'react'

import type { UIComponent } from './bee-ui'

export function GeneratedUI({
  components,
  onReply,
}: {
  components: Array<UIComponent>
  onReply?: (text: string) => void | Promise<void>
}) {
  if (components.length === 0) return null
  return (
    <div className="generated-stack">
      {components.map((component, index) => (
        <UIComponentView
          key={`${component.type}-${index}`}
          component={component}
          onReply={onReply}
        />
      ))}
    </div>
  )
}

function UIComponentView({
  component,
  onReply,
}: {
  component: UIComponent
  onReply?: (text: string) => void | Promise<void>
}) {
  switch (component.type) {
    case 'text':
      return <p>{component.body}</p>
    case 'metric':
      return (
        <Card>
          <p className="utility-label">{component.label}</p>
          <div className="metric-row">
            <strong>{component.value}</strong>
            {component.delta ? <span>{component.delta}</span> : null}
          </div>
        </Card>
      )
    case 'chart':
      return <BarChartCard {...component} />
    case 'tasks':
      return <TaskListCard {...component} />
    case 'highlight':
      return (
        <section className="highlight-card">
          <p className="utility-label">{component.title}</p>
          <p>{component.body}</p>
        </section>
      )
    case 'first_focus':
      return <FirstFocusPreviewCard preview={component} />
    case 'confirm':
      return (
        <Card className="confirm-card">
          <p className="utility-label">Needs your confirmation</p>
          <p>{component.summary}</p>
          {onReply ? (
            <div className="confirm-card__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => void onReply('Yes')}
              >
                Yes
              </button>
              <button
                className="button button--quiet"
                type="button"
                onClick={() => void onReply('No')}
              >
                No
              </button>
            </div>
          ) : null}
        </Card>
      )
  }
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`generated-card ${className}`}>{children}</section>
}

function BarChartCard({
  title,
  unit,
  data,
}: Extract<UIComponent, { type: 'chart' }>) {
  const max = Math.max(...data.map((point) => point.value), 1)
  return (
    <Card>
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map((point) => (
          <div className="bar-chart__item" key={point.label}>
            <span>{point.label}</span>
            <div className="bar-chart__row">
              <div className="bar-chart__track">
                <div
                  className="bar-chart__fill"
                  style={{
                    width: `${Math.max((point.value / max) * 100, 2)}%`,
                  }}
                />
              </div>
              <strong>
                {point.value}
                {unit ? ` ${unit}` : ''}
              </strong>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TaskListCard({
  title,
  items,
}: Extract<UIComponent, { type: 'tasks' }>) {
  const live = useQuery(api.tasks.statuses, {
    taskIds: items.map((item) => item.id),
  })
  const toggle = useMutation(api.tasks.toggle)
  const liveById = new Map(
    live?.map((task): [string, typeof task] => [task.id, task]),
  )

  return (
    <Card>
      <h3>{title}</h3>
      <div className="task-card-list">
        {items.map((item) => {
          const liveTask = liveById.get(item.id)
          const liveStatus = liveTask?.status
          const done = liveStatus ? liveStatus === 'done' : item.done
          const interactive = liveTask !== undefined
          return (
            <button
              type="button"
              className="task-card-row"
              key={item.id}
              role="checkbox"
              aria-checked={done}
              disabled={!interactive}
              onClick={() => {
                if (liveTask) void toggle({ taskId: liveTask.id })
              }}
            >
              <span className={`task-check${done ? ' is-done' : ''}`}>
                {done ? '✓' : ''}
              </span>
              <span className="task-card-row__copy">
                <span className={done ? 'is-complete' : ''}>{item.title}</span>
                {item.due ? <small>{item.due}</small> : null}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
