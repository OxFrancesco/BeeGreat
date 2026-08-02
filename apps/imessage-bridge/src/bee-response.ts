import { scrubIdentifiers } from '@beegreat/tool-presentation'

export type FirstFocusPreview = {
  type: 'first_focus'
  requestId: string
  goalTitle: string
  projectTitle: string
  taskTitle: string
  highlightExpiresAt?: number
}

export type Web3Confirmation = {
  actionId: string
  summary: string
}

export type Web3ActionProjection = {
  summary: string
  status:
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'executed'
    | 'failed'
    | 'refunded'
    | 'cancelled'
    | 'expired'
  autoConfirmed: boolean
  error?: string | null
}

type BeeComponent =
  | { type: 'text'; body: string }
  | { type: 'metric'; label: string; value: string; delta?: string }
  | {
      type: 'chart'
      kind: 'bar'
      title: string
      unit?: string
      data: { label: string; value: number }[]
    }
  | {
      type: 'tasks'
      title: string
      items: { id: string; title: string; done: boolean; due?: string }[]
    }
  | { type: 'highlight'; title: string; body: string }
  | { type: 'bookmark'; title: string; url: string; note?: string }
  | {
      type: 'devin'
      title: string
      status: string
      statusDetail?: string
      sessionId: string
      sessionUrl: string
      summary?: string
      pullRequests: { url: string; state?: string }[]
    }
  | FirstFocusPreview
  | { type: 'confirm'; summary: string; action: string; payload?: unknown }

export type BeeResponseProjection = {
  spoken: string
  markdown: string
  links: string[]
  firstFocus?: FirstFocusPreview
  web3Confirmation?: Web3Confirmation
}

type ConversationMessageLike = {
  id?: string
  role: string
  parts?: readonly {
    type: string
    text?: string
    state?: string
  }[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function optionalString(value: unknown) {
  return value === undefined ? undefined : nonEmpty(value)
}

function safeUrl(value: unknown): string | undefined {
  const input = nonEmpty(value)
  if (!input) return undefined
  try {
    const url = new URL(input)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function parseComponent(value: unknown): BeeComponent | undefined {
  const input = record(value)
  const type = nonEmpty(input?.type)
  if (!input || !type) return undefined

  if (type === 'text') {
    const body = nonEmpty(input.body)
    return body ? { type, body } : undefined
  }
  if (type === 'metric') {
    const label = nonEmpty(input.label)
    const metricValue = nonEmpty(input.value)
    const delta = optionalString(input.delta)
    return label && metricValue && (input.delta === undefined || delta)
      ? { type, label, value: metricValue, ...(delta ? { delta } : {}) }
      : undefined
  }
  if (type === 'chart') {
    const title = nonEmpty(input.title)
    const unit = optionalString(input.unit)
    if (
      input.kind !== 'bar' ||
      !title ||
      (input.unit !== undefined && !unit) ||
      !Array.isArray(input.data)
    ) {
      return undefined
    }
    const data = input.data.flatMap((item) => {
      const row = record(item)
      const label = nonEmpty(row?.label)
      return label && typeof row?.value === 'number' && Number.isFinite(row.value)
        ? [{ label, value: row.value }]
        : []
    })
    return data.length
      ? { type, kind: 'bar', title, ...(unit ? { unit } : {}), data }
      : undefined
  }
  if (type === 'tasks') {
    const title = nonEmpty(input.title)
    if (!title || !Array.isArray(input.items)) return undefined
    const items = input.items.flatMap((item) => {
      const task = record(item)
      const id = nonEmpty(task?.id)
      const taskTitle = nonEmpty(task?.title)
      const due = optionalString(task?.due)
      return id &&
        taskTitle &&
        typeof task?.done === 'boolean' &&
        (task.due === undefined || due)
        ? [
            {
              id,
              title: taskTitle,
              done: task.done,
              ...(due ? { due } : {}),
            },
          ]
        : []
    })
    return items.length ? { type, title, items } : undefined
  }
  if (type === 'highlight') {
    const title = nonEmpty(input.title)
    const body = nonEmpty(input.body)
    return title && body ? { type, title, body } : undefined
  }
  if (type === 'bookmark') {
    const title = nonEmpty(input.title)
    const url = safeUrl(input.url)
    const note = optionalString(input.note)
    return title && url && (input.note === undefined || note)
      ? { type, title, url, ...(note ? { note } : {}) }
      : undefined
  }
  if (type === 'devin') {
    const title = nonEmpty(input.title)
    const status = nonEmpty(input.status)
    const statusDetail = optionalString(input.statusDetail)
    const sessionId = nonEmpty(input.sessionId)
    const sessionUrl = safeUrl(input.sessionUrl)
    const summary = optionalString(input.summary)
    if (
      !title ||
      !status ||
      !sessionId ||
      !sessionUrl ||
      !Array.isArray(input.pullRequests) ||
      (input.statusDetail !== undefined && !statusDetail) ||
      (input.summary !== undefined && !summary)
    ) {
      return undefined
    }
    const pullRequests = input.pullRequests.flatMap((item) => {
      const pullRequest = record(item)
      const url = safeUrl(pullRequest?.url)
      const state = optionalString(pullRequest?.state)
      return url && (pullRequest?.state === undefined || state)
        ? [{ url, ...(state ? { state } : {}) }]
        : []
    })
    if (pullRequests.length !== input.pullRequests.length) return undefined
    return {
      type,
      title,
      status,
      ...(statusDetail ? { statusDetail } : {}),
      sessionId,
      sessionUrl,
      ...(summary ? { summary } : {}),
      pullRequests,
    }
  }
  if (type === 'first_focus') {
    const requestId = nonEmpty(input.requestId)
    const goalTitle = nonEmpty(input.goalTitle)
    const projectTitle = nonEmpty(input.projectTitle)
    const taskTitle = nonEmpty(input.taskTitle)
    const highlightExpiresAt = input.highlightExpiresAt
    return requestId &&
      goalTitle &&
      projectTitle &&
      taskTitle &&
      (highlightExpiresAt === undefined ||
        (typeof highlightExpiresAt === 'number' &&
          Number.isFinite(highlightExpiresAt)))
      ? {
          type,
          requestId,
          goalTitle,
          projectTitle,
          taskTitle,
          ...(typeof highlightExpiresAt === 'number'
            ? { highlightExpiresAt }
            : {}),
        }
      : undefined
  }
  if (type === 'confirm') {
    const summary = nonEmpty(input.summary)
    const action = nonEmpty(input.action)
    return summary && action
      ? {
          type,
          summary,
          action,
          ...(input.payload === undefined ? {} : { payload: input.payload }),
        }
      : undefined
  }
  return undefined
}

function parseComponents(source: string): BeeComponent[] {
  try {
    const payload = record(JSON.parse(source))
    if (!payload || !Array.isArray(payload.components)) return []
    const components = payload.components
      .map(parseComponent)
      .filter((component): component is BeeComponent => Boolean(component))
    return components.length === payload.components.length ? components : []
  } catch {
    return []
  }
}

function clean(text: string) {
  return scrubIdentifiers(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function web3Confirmation(
  component: BeeComponent,
): Web3Confirmation | undefined {
  if (component.type !== 'confirm') return undefined
  const actionId = nonEmpty(record(component.payload)?.web3ActionId)
  return actionId ? { actionId, summary: component.summary } : undefined
}

function renderComponent(component: BeeComponent): {
  markdown: string
  links: string[]
} {
  switch (component.type) {
    case 'text':
      return { markdown: clean(component.body), links: [] }
    case 'metric':
      return {
        markdown: `**${clean(component.label)}:** ${clean(component.value)}${
          component.delta ? ` — ${clean(component.delta)}` : ''
        }`,
        links: [],
      }
    case 'chart':
      return {
        markdown: [
          `**${clean(component.title)}**`,
          ...component.data.map(
            (item) =>
              `${clean(item.label)}: ${item.value}${
                component.unit ? ` ${clean(component.unit)}` : ''
              }`,
          ),
        ].join('\n'),
        links: [],
      }
    case 'tasks':
      return {
        markdown: [
          `**${clean(component.title)}**`,
          ...component.items.map(
            (item) =>
              `${item.done ? '☑' : '☐'} ${clean(item.title)}${
                item.due ? ` — ${clean(item.due)}` : ''
              }`,
          ),
          'Reply with the exact Task you want Bee to work with.',
        ].join('\n'),
        links: [],
      }
    case 'highlight':
      return {
        markdown: `**${clean(component.title)}**\n${clean(component.body)}`,
        links: [],
      }
    case 'bookmark':
      return {
        markdown: `**${clean(component.title)}**${
          component.note ? `\n${clean(component.note)}` : ''
        }`,
        links: [component.url],
      }
    case 'devin':
      return {
        markdown: [
          `**${clean(component.title)}** — ${clean(component.status)}`,
          component.statusDetail ? clean(component.statusDetail) : '',
          component.summary ? clean(component.summary) : '',
          ...component.pullRequests.map(
            (pullRequest) =>
              `Pull request${pullRequest.state ? ` — ${clean(pullRequest.state)}` : ''}`,
          ),
        ]
          .filter(Boolean)
          .join('\n'),
        links: [
          component.sessionUrl,
          ...component.pullRequests.map((pullRequest) => pullRequest.url),
        ],
      }
    case 'first_focus':
      return {
        markdown: [
          '**Your first focus**',
          `Goal: ${clean(component.goalTitle)}`,
          `Project: ${clean(component.projectTitle)}`,
          `Task: ${clean(component.taskTitle)}`,
          'Reply **yes** to create it or **no** to cancel.',
        ].join('\n'),
        links: [],
      }
    case 'confirm':
      if (web3Confirmation(component)) {
        return {
          markdown: [
            '**Needs your confirmation**',
            clean(component.summary),
            'Reply **yes** to authorize this exact action or **no** to cancel it.',
          ].join('\n'),
          links: [],
        }
      }
      return {
        markdown: [
          '**Needs your confirmation**',
          clean(component.summary),
          'Reply **yes** to continue or **no** to cancel.',
        ].join('\n'),
        links: [],
      }
  }
}

export function extractBeeResponse(text: string): BeeResponseProjection {
  const components: BeeComponent[] = []
  const spoken = clean(
    text.replace(/```beeui\s*([\s\S]*?)```/gi, (_block, json: string) => {
      components.push(...parseComponents(json.trim()))
      return ''
    }),
  )
  const rendered = components.map(renderComponent)
  const markdown = [spoken, ...rendered.map((item) => item.markdown)]
    .filter(Boolean)
    .join('\n\n')
  const firstFocus = components.find(
    (component): component is FirstFocusPreview =>
      component.type === 'first_focus',
  )
  const web3Confirmations = components
    .map(web3Confirmation)
    .filter((confirmation): confirmation is Web3Confirmation =>
      Boolean(confirmation),
    )
  const pendingWeb3 =
    web3Confirmations.length === 1 ? web3Confirmations[0] : undefined
  return {
    spoken,
    markdown,
    links: [
      ...new Set(rendered.flatMap((item) => item.links)),
    ],
    ...(firstFocus ? { firstFocus } : {}),
    ...(pendingWeb3 ? { web3Confirmation: pendingWeb3 } : {}),
  }
}

export function projectWeb3Action(
  response: BeeResponseProjection,
  action: Web3ActionProjection,
): BeeResponseProjection {
  const confirmation = response.web3Confirmation
  if (!confirmation) return response
  const original = renderComponent({
    type: 'confirm',
    summary: confirmation.summary,
    action: 'web3',
    payload: { web3ActionId: confirmation.actionId },
  }).markdown
  const canonical = {
    actionId: confirmation.actionId,
    summary: action.summary,
  }

  if (action.status === 'pending') {
    const replacement = renderComponent({
      type: 'confirm',
      summary: action.summary,
      action: 'web3',
      payload: { web3ActionId: confirmation.actionId },
    }).markdown
    return {
      ...response,
      markdown: response.markdown.replace(original, replacement),
      web3Confirmation: canonical,
    }
  }

  const terminalTitles: Partial<
    Record<Web3ActionProjection['status'], string>
  > = {
    executed: '**Web3 action complete**',
    failed: '**Web3 action failed**',
    refunded: '**Web3 action refunded**',
    cancelled: '**Web3 action cancelled**',
    expired: '**Web3 confirmation expired**',
  }
  const title =
    action.autoConfirmed && action.status === 'confirmed'
      ? '**Auto-approved · YOLO mode**'
      : terminalTitles[action.status] ?? '**Web3 action in progress**'
  const detail =
    action.status === 'failed' && action.error
      ? clean(action.error)
      : action.status === 'confirmed' || action.status === 'in_progress'
        ? 'Execution has started. Ask Bee for the latest status anytime.'
        : ''
  const replacement = [title, clean(action.summary), detail]
    .filter(Boolean)
    .join('\n')
  const { web3Confirmation: _confirmation, ...withoutConfirmation } = response
  return {
    ...withoutConfirmation,
    markdown: response.markdown.replace(original, replacement),
  }
}

function latestAssistantProjection(
  messages: readonly ConversationMessageLike[],
) {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')
  if (!latestAssistant) return undefined
  const text = (latestAssistant.parts ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
  return extractBeeResponse(text)
}

export function latestFirstFocusPreview(
  messages: readonly ConversationMessageLike[],
) {
  return latestAssistantProjection(messages)?.firstFocus
}

export function latestWeb3Confirmation(
  messages: readonly ConversationMessageLike[],
) {
  return latestAssistantProjection(messages)?.web3Confirmation
}

export function isFirstFocusConfirmation(text: string): boolean {
  return /^(yes|yep|confirm|confirmed|looks good|create it|do it)[.!]?$/i.test(
    text.trim(),
  )
}

export function isFirstFocusCancellation(text: string): boolean {
  return /^(no|nope|cancel|never mind|nevermind)[.!]?$/i.test(text.trim())
}

export function isWeb3Confirmation(text: string): boolean {
  return /^yes[.!]?$/i.test(text.trim())
}

export function isWeb3Cancellation(text: string): boolean {
  return /^no[.!]?$/i.test(text.trim())
}

export function isHighlightCompletion(text: string): boolean {
  const command = text.trim()
  return (
    /^(i(?:'ve| have)? )?(completed|finished) ((my|the|this) )?(highlight|task|it)[.!]?$/i.test(
      command,
    ) ||
    /^(complete|finish) ((my|the|this) )?(highlight|task)[.!]?$/i.test(
      command,
    ) ||
    /^mark ((my|the|this) )?(highlight|task|it)( as)? done[.!]?$/i.test(
      command,
    )
  )
}
