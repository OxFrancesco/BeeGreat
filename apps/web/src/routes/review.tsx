import { SignInButton, SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { Component, useState } from 'react'
import { api } from '@beegreat/backend/convex/_generated/api'
import type { ReactNode } from 'react'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'

export const Route = createFileRoute('/review')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(search.site) ? search.site : undefined,
    comment: typeof search.comment === 'string' && /^[a-z0-9]{16,64}$/.test(search.comment) ? search.comment : undefined,
  }),
  component: ReviewPage,
})

class ReviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p role="alert">This review is unavailable.</p> : this.props.children }
}

function ReviewPage() {
  const { site, comment } = Route.useSearch()
  const valid = Boolean(site) !== Boolean(comment)
  const returnUrl = site ? `/review?site=${encodeURIComponent(site)}` : `/review?comment=${encodeURIComponent(comment ?? '')}`
  return (
    <main className="approval-review">
      <h1>{site ? 'Publish site' : comment ? 'Post comment' : 'Review unavailable'}</h1>
      {!valid ? <p>This review link is invalid.</p> : <>
        <SignedOut><SignInButton mode="modal" forceRedirectUrl={returnUrl}><button className="button button--primary" type="button">Sign in to review</button></SignInButton></SignedOut>
        <SignedIn><ReviewBoundary key={returnUrl}>{site ? <SiteReview version={site} /> : <CommentReview actionId={comment as Id<'beennectorCommentActions'>} />}</ReviewBoundary></SignedIn>
      </>}
    </main>
  )
}

function useReviewAction() {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  async function run(action: () => Promise<unknown>) {
    if (working) return
    setWorking(true); setError(undefined)
    try { await action() } catch { setError('Could not complete this decision. Refresh to check its status before trying again.') }
    finally { setWorking(false) }
  }
  return { working, error, run }
}

export function SiteReview({ version }: { version: string }) {
  const { isAuthenticated } = useConvexAuth()
  const review = useQuery(api.beeSites.reviewPreview, isAuthenticated ? { version } : 'skip')
  const publish = useMutation(api.beeSites.publishPreview)
  const cancel = useMutation(api.beeSites.cancelPublication)
  const action = useReviewAction()
  if (review === undefined) return <p role="status">Loading preview...</p>
  if (!review) return <p>This preview is unavailable for your account.</p>
  return <>
    <h2>{review.title}</h2>
    <a href={review.previewUrl} target="_blank" rel="noopener noreferrer">Open this preview</a>
    <p>Publish to <a href={review.publicUrl} target="_blank" rel="noopener noreferrer">{review.publicUrl}</a></p>
    {review.state === 'pending' ? <div className="approval-review__actions">
      <button className="button button--primary" disabled={action.working || !review.contentDigest} onClick={() => void action.run(() => publish({ version, expectedContentDigest: review.contentDigest!, expectedSlug: review.slug, expectedPublicationRevision: review.publicationRevision }))}>Publish this preview</button>
      <button className="button" disabled={action.working} onClick={() => void action.run(() => cancel({ version }))}>Cancel</button>
    </div> : <p role="status">{review.state === 'approved' ? 'Publication approved.' : review.state === 'cancelled' ? 'Publication cancelled.' : review.state === 'expired' ? 'This preview expired. Ask Bee for a new preview.' : 'This preview cannot be published. Ask Bee for a new preview.'}</p>}
    {action.error ? <p role="alert">{action.error}</p> : null}
  </>
}

export function CommentReview({ actionId }: { actionId: Id<'beennectorCommentActions'> }) {
  const { isAuthenticated } = useConvexAuth()
  const review = useQuery(api.beennectorComments.status, isAuthenticated ? { actionId } : 'skip')
  const confirm = useMutation(api.beennectorComments.confirm)
  const cancel = useMutation(api.beennectorComments.cancel)
  const action = useReviewAction()
  if (review === undefined) return <p role="status">Loading comment...</p>
  if (!review) return <p>This comment is unavailable for your account.</p>
  return <>
    <h2>{review.targetLabel}</h2>
    <a href={review.targetUrl} target="_blank" rel="noopener noreferrer">{review.targetUrl}</a>
    <p>{review.provider === 'github' ? 'GitHub' : 'Linear'} account: {review.accountName}</p>
    <div className="approval-review__comment">{review.body}</div>
    {review.state === 'pending' ? <div className="approval-review__actions">
      <button className="button button--primary" disabled={action.working} onClick={() => void action.run(() => confirm({ actionId, expectedProvider: review.provider, expectedTargetId: review.targetId, expectedBody: review.body, expectedAccountId: review.externalAccountId, expectedTargetUrl: review.targetUrl }))}>Post this comment</button>
      <button className="button" disabled={action.working} onClick={() => void action.run(() => cancel({ actionId }))}>Cancel</button>
    </div> : <p role="status">{review.state === 'posted' ? 'Comment posted.' : review.state === 'confirmed' ? 'Waiting to post...' : review.state === 'executing' ? 'Posting comment...' : review.state === 'cancelled' ? 'Comment cancelled.' : review.state === 'unavailable' ? 'The approval expired or the connected account changed. Ask Bee for a new comment.' : review.error ?? 'The outcome is not confirmed. Check the destination before requesting another comment.'}</p>}
    {review.state === 'confirmed' ? <button className="button" disabled={action.working} onClick={() => void action.run(() => cancel({ actionId }))}>Cancel before posting</button> : null}
    {review.resultUrl ? <a href={review.resultUrl} target="_blank" rel="noopener noreferrer">Open posted comment</a> : null}
    {action.error ? <p role="alert">{action.error}</p> : null}
  </>
}
