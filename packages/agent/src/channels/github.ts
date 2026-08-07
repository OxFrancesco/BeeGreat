import { createGitHubChannel } from '@flue/github'
import { dispatch } from '@flue/runtime'
import { Bee } from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
  signalAttributes,
} from '../shared/beennectors/channel.ts'

export const channel = createGitHubChannel({
  webhookSecret: channelSecret('GITHUB_WEBHOOK_SECRET'),
  async webhook({ delivery }) {
    if (
      delivery.name !== 'issues' &&
      delivery.name !== 'issue_comment' &&
      delivery.name !== 'pull_request' &&
      delivery.name !== 'pull_request_review_comment'
    ) {
      return undefined
    }
    const payload = delivery.payload
    const claim = await claimBeennectorDelivery({
      provider: 'github',
      deliveryId: delivery.deliveryId,
      actorId: String(payload.sender.id),
    })
    if (claim.status !== 'accepted') return undefined

    const repository = payload.repository
    const issue = 'issue' in payload ? payload.issue : undefined
    const pullRequest =
      'pull_request' in payload ? payload.pull_request : undefined
    const comment = 'comment' in payload ? payload.comment : undefined
    const action = 'action' in payload ? payload.action : 'updated'
    const repoName = `${repository.owner.login}/${repository.name}`
    const number = issue?.number ?? pullRequest?.number ?? null
    const title = issue?.title ?? pullRequest?.title ?? null
    const commentBody =
      comment && 'body' in comment ? (comment.body ?? '') : null
    await dispatch(Bee, {
      id: beennectorAgentId(claim.userId, 'github'),
      message: {
        kind: 'signal',
        type: `github.${delivery.name}`,
        body:
          commentBody ||
          `${action} on ${repoName}${number === null ? '' : `#${number}`}${title ? `: ${title}` : ''}`,
        attributes: signalAttributes({
          deliveryId: delivery.deliveryId,
          action,
          repository: repoName,
          number,
          title,
          sender: payload.sender.login,
          commentId: comment ? comment.id : null,
          url:
            issue?.html_url ??
            pullRequest?.html_url ??
            ('html_url' in repository ? repository.html_url : null),
        }),
      },
    })
    return undefined
  },
})
