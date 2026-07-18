import { createGitHubChannel } from '@flue/github'
import { dispatch } from '@flue/runtime'
import bee from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
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
      return
    }
    const payload = delivery.payload
    const claim = await claimBeennectorDelivery({
      provider: 'github',
      deliveryId: delivery.deliveryId,
      actorId: String(payload.sender.id),
    })
    if (claim.status !== 'accepted') return

    const repository = payload.repository
    const issue = 'issue' in payload ? payload.issue : undefined
    const pullRequest =
      'pull_request' in payload ? payload.pull_request : undefined
    const comment = 'comment' in payload ? payload.comment : undefined
    await dispatch(bee, {
      id: beennectorAgentId(claim.userId, 'github'),
      input: {
        type: `github.${delivery.name}`,
        deliveryId: delivery.deliveryId,
        action: 'action' in payload ? payload.action : 'updated',
        repository: `${repository.owner.login}/${repository.name}`,
        number: issue?.number ?? pullRequest?.number ?? null,
        title: issue?.title ?? pullRequest?.title ?? null,
        sender: payload.sender.login,
        comment:
          comment && 'body' in comment
            ? { id: comment.id, body: comment.body ?? '' }
            : null,
        url:
          issue?.html_url ??
          pullRequest?.html_url ??
          ('html_url' in repository ? repository.html_url : null),
      },
    })
  },
})
