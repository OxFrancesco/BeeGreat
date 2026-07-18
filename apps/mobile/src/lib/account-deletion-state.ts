export type PendingAccountDeletionRecord = {
  jobId: string;
  activationToken: string;
  phase: 'prepared' | 'identity_deleted';
  /** Missing only on records written before deletion intents were user-bound. */
  clerkUserId?: string;
};

export type PendingDeletionResumeDecision =
  | 'activate_anonymously'
  | 'activate_same_user'
  | 'cancel_same_user'
  | 'cancel_legacy_if_owner'
  | 'wait';

const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]+$/;

/** Parses both current records and the pre-user-binding legacy shape. */
export function parsePendingAccountDeletion(
  serialized: string,
): PendingAccountDeletionRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.jobId !== 'string' ||
    record.jobId.length === 0 ||
    typeof record.activationToken !== 'string' ||
    record.activationToken.length === 0 ||
    (record.phase !== 'prepared' && record.phase !== 'identity_deleted')
  ) {
    return null;
  }
  const hasClerkUserId = Object.prototype.hasOwnProperty.call(
    record,
    'clerkUserId',
  );
  if (
    hasClerkUserId &&
    (typeof record.clerkUserId !== 'string' ||
      !CLERK_USER_ID_PATTERN.test(record.clerkUserId))
  ) {
    return null;
  }
  return {
    jobId: record.jobId,
    activationToken: record.activationToken,
    phase: record.phase,
    ...(hasClerkUserId
      ? { clerkUserId: record.clerkUserId as string }
      : {}),
  };
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
