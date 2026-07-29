import { api } from '@beegreat/backend/convex/_generated/api'
import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useAction, useMutation } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'

import { captureWebFailure } from '~/lib/sentry'

const STORAGE_KEY = 'bee.pendingAccountDeletion.v1'

type PendingDeletion = {
  jobId: Id<'accountDeletionJobs'>
  activationToken: string
  phase: 'prepared' | 'identity_deleted'
  clerkUserId: string
}

let resumePromise: Promise<void> | null = null

function readPending(): PendingDeletion | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as PendingDeletion) : null
  } catch {
    return null
  }
}

function savePending(pending: PendingDeletion) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
}

function clearPending() {
  localStorage.removeItem(STORAGE_KEY)
}

function useDeletionOperations() {
  return {
    activate: useMutation(api.accountDeletion.activate),
    cancel: useMutation(api.accountDeletion.cancel),
  }
}

export function AccountDeletionResume() {
  const { user } = useUser()
  const { activate, cancel } = useDeletionOperations()

  useEffect(() => {
    if (resumePromise) return
    const pending = readPending()
    if (!pending) return
    resumePromise = (async () => {
      if (pending.phase === 'identity_deleted') {
        if (user && user.id !== pending.clerkUserId) return
        await activate({
          jobId: pending.jobId,
          activationToken: pending.activationToken,
        })
        clearPending()
        return
      }
      if (user?.id !== pending.clerkUserId) return
      const result = await cancel({
        jobId: pending.jobId,
        activationToken: pending.activationToken,
      })
      if (result.status === 'cancelled') clearPending()
    })()
      .catch((cause) => captureWebFailure(cause, 'account.delete_resume'))
      .finally(() => {
        resumePromise = null
      })
  }, [activate, cancel, user?.id])

  return null
}

export function useAccountDeletion() {
  const { user } = useUser()
  const clerk = useClerk()
  const prepare = useMutation(api.accountDeletion.prepare)
  const revokeApple = useAction(
    api.accountDeletionActions.revokeAppleBeforeIdentityDeletion,
  )
  const { activate, cancel } = useDeletionOperations()
  const working = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()

  const requestDeletion = useCallback(async () => {
    if (!user || working.current) return
    const confirmed = window.confirm(
      'Delete your BeeGreat account permanently? This removes your active goals, conversations, Mind, Hive, health journal, and connection credentials. This cannot be undone.\n\nDeleting BeeGreat does not cancel an Apple subscription; cancel it in your Apple account first.',
    )
    if (!confirmed) return
    const typed = window.prompt(
      'Type DELETE to confirm permanent account deletion.',
    )
    if (typed !== 'DELETE') return

    working.current = true
    setDeleting(true)
    setError(undefined)
    const activationToken = crypto.randomUUID()
    let pending: PendingDeletion | undefined
    let identityDeleted = false
    try {
      const prepared = await prepare({
        confirmation: 'DELETE',
        activationToken,
      })
      pending = {
        jobId: prepared.jobId,
        activationToken,
        phase: 'prepared',
        clerkUserId: user.id,
      }
      savePending(pending)
      await revokeApple({ jobId: pending.jobId, activationToken })
      await user.delete()
      identityDeleted = true
      pending = { ...pending, phase: 'identity_deleted' }
      savePending(pending)
      await activate({ jobId: pending.jobId, activationToken })
      clearPending()
      await clerk.signOut()
    } catch (cause) {
      captureWebFailure(cause, 'account.delete')
      if (!identityDeleted && pending) {
        try {
          const result = await cancel({ jobId: pending.jobId, activationToken })
          if (result.status === 'cancelled') clearPending()
        } catch (cancelCause) {
          captureWebFailure(cancelCause, 'account.delete_cancel')
        }
      }
      setError(
        identityDeleted
          ? 'Your sign-in account was deleted. BeeGreat data cleanup will resume automatically.'
          : 'Your account could not be deleted. No BeeGreat data was erased; try again or contact support.',
      )
    } finally {
      working.current = false
      setDeleting(false)
    }
  }, [activate, cancel, clerk, prepare, revokeApple, user])

  return { deleting, error, requestDeletion }
}
