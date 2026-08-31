import {
  deriveBeeUiFollowUps,
  extractBeeUi,
  projectTextWeb3Action,
  renderBeeUiMarkdown,
  resolveBeeQuestionAnswer,
  type BeeQuestion,
  type FirstFocusPreview,
  type TextWeb3Action,
  type Web3Confirmation,
} from '@beegreat/tool-presentation'

export type {
  FirstFocusPreview,
  Web3Confirmation,
} from '@beegreat/tool-presentation'

export type Web3ActionProjection = TextWeb3Action

export type BeeResponseProjection = {
  spoken: string
  markdown: string
  links: string[]
  firstFocus?: FirstFocusPreview
  web3Confirmation?: Web3Confirmation
  question?: BeeQuestion
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

function web3ConfirmMarkdown(confirmation: Web3Confirmation): string {
  return renderBeeUiMarkdown({
    type: 'confirm',
    summary: confirmation.summary,
    action: 'web3',
    payload: { web3ActionId: confirmation.actionId },
  }).markdown
}

export function extractBeeResponse(text: string): BeeResponseProjection {
  const { spoken, components } = extractBeeUi(text)
  const rendered = components.map(renderBeeUiMarkdown)
  const followUps = deriveBeeUiFollowUps(components)
  // A blocking decision is the latest coherent stage. Earlier drafts and
  // progress copy in Flue's accumulated envelope must not compete with it.
  const markdown = followUps.question
    ? renderBeeUiMarkdown({
        type: 'question',
        questions: followUps.question.questions,
      }).markdown
    : [spoken, ...rendered.map((item) => item.markdown)]
        .filter(Boolean)
        .join('\n\n')
  const projection: BeeResponseProjection = {
    spoken,
    markdown,
    links: [...new Set(rendered.flatMap((item) => item.links))],
  }
  if (followUps.firstFocus) projection.firstFocus = followUps.firstFocus
  if (followUps.web3Confirmation) {
    projection.web3Confirmation = followUps.web3Confirmation
  }
  if (followUps.question) projection.question = followUps.question
  return projection
}

export function projectWeb3Action(
  response: BeeResponseProjection,
  action: Web3ActionProjection,
): BeeResponseProjection {
  const confirmation = response.web3Confirmation
  if (!confirmation) return response
  const original = web3ConfirmMarkdown(confirmation)
  const canonical = {
    actionId: confirmation.actionId,
    summary: action.summary,
  }
  const projected = projectTextWeb3Action(action)
  const { web3Confirmation: _confirmation, ...withoutConfirmation } = response
  const reprojected: BeeResponseProjection = {
    ...withoutConfirmation,
    markdown: response.markdown.replace(original, projected.text),
    links: [...new Set([...response.links, ...projected.links])],
  }
  if (projected.requiresTextConfirmation) {
    reprojected.web3Confirmation = canonical
  }
  return reprojected
}

function latestAssistantProjection(
  messages: readonly ConversationMessageLike[],
) {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')
  if (!latestAssistant) return undefined
  const projections = (latestAssistant.parts ?? []).flatMap((part) =>
    part.type === 'text' && part.text !== undefined
      ? [extractBeeResponse(part.text)]
      : [],
  )
  return (
    [...projections].reverse().find((projection) => projection.question) ??
    [...projections]
      .reverse()
      .find(
        (projection) => projection.web3Confirmation || projection.firstFocus,
      ) ??
    projections.at(-1)
  )
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

export function latestQuestion(messages: readonly ConversationMessageLike[]) {
  return latestAssistantProjection(messages)?.question
}

export function resolveQuestionAnswer(
  question: BeeQuestion | undefined,
  answer: string,
) {
  return resolveBeeQuestionAnswer(question, answer)
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
    /^mark ((my|the|this) )?(highlight|task|it)( as)? done[.!]?$/i.test(command)
  )
}
