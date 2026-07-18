// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { describe, expect, test } from 'bun:test';

import {
  deletionSessionIdToSignOut,
  parsePendingAccountDeletion,
  pendingDeletionResumeDecision,
  type PendingAccountDeletionRecord,
} from './account-deletion-state';

const currentRecord: PendingAccountDeletionRecord = {
  jobId: 'job_current',
  activationToken: 'account-deletion-capability-current',
  phase: 'identity_deleted',
  clerkUserId: 'user_owner',
};

describe('persisted account-deletion state', () => {
  test('parses user-bound records and preserves the legacy record shape', () => {
    expect(parsePendingAccountDeletion(JSON.stringify(currentRecord))).toEqual(
      currentRecord,
    );
    expect(
      parsePendingAccountDeletion(
        JSON.stringify({
          jobId: 'job_legacy',
          activationToken: 'account-deletion-capability-legacy',
          phase: 'prepared',
        }),
      ),
    ).toEqual({
      jobId: 'job_legacy',
      activationToken: 'account-deletion-capability-legacy',
      phase: 'prepared',
    });
  });

  test('rejects malformed or ambiguously user-bound records', () => {
    expect(parsePendingAccountDeletion('{')).toBeNull();
    expect(
      parsePendingAccountDeletion(
        JSON.stringify({ ...currentRecord, clerkUserId: null }),
      ),
    ).toBeNull();
    expect(
      parsePendingAccountDeletion(
        JSON.stringify({ ...currentRecord, clerkUserId: 'different-format' }),
      ),
    ).toBeNull();
  });
});

describe('account-deletion resume identity binding', () => {
  test('activates a deleted-identity record only for the same user or anonymously', () => {
    expect(pendingDeletionResumeDecision(currentRecord, 'user_owner')).toBe(
      'activate_same_user',
    );
    expect(pendingDeletionResumeDecision(currentRecord, null)).toBe(
      'activate_anonymously',
    );
    expect(
      pendingDeletionResumeDecision(currentRecord, 'user_different'),
    ).toBe('wait');
  });

  test('cancels a prepared record only for the same identified user', () => {
    const prepared = { ...currentRecord, phase: 'prepared' as const };
    expect(pendingDeletionResumeDecision(prepared, 'user_owner')).toBe(
      'cancel_same_user',
    );
    expect(pendingDeletionResumeDecision(prepared, 'user_different')).toBe(
      'wait',
    );
    expect(pendingDeletionResumeDecision(prepared, null)).toBe('wait');
  });

  test('migrates legacy records without ever signing out a loaded user', () => {
    const legacyDeleted: PendingAccountDeletionRecord = {
      jobId: 'job_legacy',
      activationToken: 'account-deletion-capability-legacy',
      phase: 'identity_deleted',
    };
    expect(pendingDeletionResumeDecision(legacyDeleted, null)).toBe(
      'activate_anonymously',
    );
    expect(pendingDeletionResumeDecision(legacyDeleted, 'user_any')).toBe(
      'wait',
    );
    expect(
      pendingDeletionResumeDecision(
        { ...legacyDeleted, phase: 'prepared' },
        'user_possible_owner',
      ),
    ).toBe('cancel_legacy_if_owner');
  });

  test('selects only the active session owned by the deleted Clerk user', () => {
    expect(
      deletionSessionIdToSignOut(
        'user_owner',
        'user_owner',
        'user_owner',
        'sess_owner',
      ),
    ).toBe('sess_owner');
    expect(
      deletionSessionIdToSignOut(
        'user_owner',
        'user_different',
        'user_different',
        'sess_different',
      ),
    ).toBeNull();
    expect(
      deletionSessionIdToSignOut(
        'user_owner',
        'user_owner',
        'user_different',
        'sess_different',
      ),
    ).toBeNull();
  });
});
