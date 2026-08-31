import { z } from 'zod';

const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]+$/;

const pendingAccountDeletionSchema = z.object({
  jobId: z.string().min(1),
  activationToken: z.string().min(1),
  phase: z.enum(['prepared', 'identity_deleted']),
  /** Missing only on records written before deletion intents were user-bound. */
  clerkUserId: z.string().regex(CLERK_USER_ID_PATTERN).optional(),
});

export type PendingAccountDeletionRecord = z.infer<
  typeof pendingAccountDeletionSchema
>;

export type PendingDeletionResumeDecision =
  | 'activate_anonymously'
  | 'activate_same_user'
  | 'cancel_same_user'
  | 'cancel_legacy_if_owner'
  | 'wait';

/** Parses both current records and the pre-user-binding legacy shape. */
export function parsePendingAccountDeletion(
  serialized: string,
): PendingAccountDeletionRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }
  const record = pendingAccountDeletionSchema.safeParse(parsed);
  return record.success ? record.data : null;
}

/**
 * A capability is never resumed while a different Clerk user is active.
 * Legacy prepared records may ask the server to cancel: the authenticated
 * mutation itself proves ownership before changing anything.
 */
export function pendingDeletionResumeDecision(
  pending: PendingAccountDeletionRecord,
  currentClerkUserId: string | null,
): PendingDeletionResumeDecision {
  if (pending.phase === 'identity_deleted') {
    if (currentClerkUserId === null) return 'activate_anonymously';
    if (
      pending.clerkUserId !== undefined &&
      pending.clerkUserId === currentClerkUserId
    ) {
      return 'activate_same_user';
    }
    return 'wait';
  }

  if (currentClerkUserId === null) return 'wait';
  if (pending.clerkUserId === undefined) return 'cancel_legacy_if_owner';
  return pending.clerkUserId === currentClerkUserId
    ? 'cancel_same_user'
    : 'wait';
}

/** Returns only the exact active session belonging to the deleted user. */
export function deletionSessionIdToSignOut(
  expectedClerkUserId: string,
  activeClerkUserId: string | null,
  activeSessionUserId: string | null,
  activeSessionId: string | null,
) {
  return activeClerkUserId === expectedClerkUserId &&
    activeSessionUserId === expectedClerkUserId &&
    activeSessionId
    ? activeSessionId
    : null;
}
