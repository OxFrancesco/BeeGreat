import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useAction, useMutation } from 'convex/react';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  deletionSessionIdToSignOut,
  parsePendingAccountDeletion,
  pendingDeletionResumeDecision,
} from '@/lib/account-deletion-state';
import { captureMobileFailure } from '@/lib/sentry';

const PENDING_DELETION_KEY = 'bee.pendingAccountDeletion.v1';

type PendingDeletion = {
  jobId: Id<'accountDeletionJobs'>;
  activationToken: string;
  phase: 'prepared' | 'identity_deleted';
  clerkUserId?: string;
};

type UserBoundPendingDeletion = PendingDeletion & { clerkUserId: string };

let resumePromise: Promise<void> | null = null;

async function readPendingDeletion(): Promise<PendingDeletion | null> {
  const value = await SecureStore.getItemAsync(PENDING_DELETION_KEY);
  if (!value) return null;
  const parsed = parsePendingAccountDeletion(value);
  return parsed as PendingDeletion | null;
}

async function savePendingDeletion(pending: UserBoundPendingDeletion) {
  await SecureStore.setItemAsync(PENDING_DELETION_KEY, JSON.stringify(pending));
}

async function clearPendingDeletion() {
  await SecureStore.deleteItemAsync(PENDING_DELETION_KEY);
}

export function useAccountDeletion() {
  const { user } = useUser();
  const clerk = useClerk();
  const prepareBeeGreatDeletion = useMutation(api.accountDeletion.prepare);
  const revokeAppleBeforeIdentityDeletion = useAction(
    api.accountDeletionActions.revokeAppleBeforeIdentityDeletion,
  );
  const activateBeeGreatDeletion = useMutation(api.accountDeletion.activate);
  const cancelBeeGreatDeletion = useMutation(api.accountDeletion.cancel);
  const workingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOutIfCurrentUserMatches = useCallback(
    async (expectedClerkUserId: string) => {
      const activeSession = clerk.session;
      const sessionId = deletionSessionIdToSignOut(
        expectedClerkUserId,
        clerk.user?.id ?? null,
        activeSession?.user.id ?? null,
        activeSession?.id ?? null,
      );
      if (sessionId) await clerk.signOut({ sessionId });
    },
    [clerk],
  );

  useEffect(() => {
    if (resumePromise) return;
    resumePromise = (async () => {
      const pending = await readPendingDeletion();
      if (!pending) return;
      const decision = pendingDeletionResumeDecision(pending, user?.id ?? null);
      if (
        decision === 'activate_anonymously' ||
        decision === 'activate_same_user'
      ) {
        await activateBeeGreatDeletion({
          jobId: pending.jobId,
          activationToken: pending.activationToken,
        });
        await clearPendingDeletion();
        if (decision === 'activate_same_user' && pending.clerkUserId) {
          await signOutIfCurrentUserMatches(pending.clerkUserId);
        }
        return;
      }
      if (
        decision === 'cancel_same_user' ||
        decision === 'cancel_legacy_if_owner'
      ) {
        const result = await cancelBeeGreatDeletion({
          jobId: pending.jobId,
          activationToken: pending.activationToken,
        });
        if (result.status === 'cancelled') await clearPendingDeletion();
      }
    })()
      .catch((cause) => {
        captureMobileFailure(cause, 'account.delete_resume');
      })
      .finally(() => {
        resumePromise = null;
      });
  }, [
    activateBeeGreatDeletion,
    cancelBeeGreatDeletion,
    signOutIfCurrentUserMatches,
    user,
  ]);

  const deleteAccount = useCallback(async () => {
    if (!user || workingRef.current) return;
    workingRef.current = true;
    setDeleting(true);
    setError(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const initiatingClerkUserId = user.id;
    let pending: UserBoundPendingDeletion | null = null;
    let identityDeleted = false;
    let deletionCancelled = false;
    try {
      const activationToken = Crypto.randomUUID();
      const prepared = await prepareBeeGreatDeletion({
        confirmation: 'DELETE',
        activationToken,
      });
      pending = {
        jobId: prepared.jobId,
        activationToken,
        phase: 'prepared',
        clerkUserId: initiatingClerkUserId,
      };
      await savePendingDeletion(pending);
      await revokeAppleBeforeIdentityDeletion({
        jobId: pending.jobId,
        activationToken: pending.activationToken,
      });
      await user.delete();
      identityDeleted = true;
      pending = { ...pending, phase: 'identity_deleted' };
      await savePendingDeletion(pending);
      await activateBeeGreatDeletion({
        jobId: pending.jobId,
        activationToken: pending.activationToken,
      });
      await clearPendingDeletion();
      await signOutIfCurrentUserMatches(initiatingClerkUserId);
    } catch (cause) {
      captureMobileFailure(cause, 'account.delete');
      if (!identityDeleted && pending) {
        try {
          const cancelled = await cancelBeeGreatDeletion({
            jobId: pending.jobId,
            activationToken: pending.activationToken,
          });
          if (cancelled.status === 'cancelled') {
            deletionCancelled = true;
            await clearPendingDeletion();
          }
        } catch (cancelCause) {
          captureMobileFailure(cancelCause, 'account.delete_cancel');
        }
      }
      if (identityDeleted) {
        await signOutIfCurrentUserMatches(initiatingClerkUserId).catch(
          (signOutCause) => {
            captureMobileFailure(signOutCause, 'account.delete_sign_out');
          },
        );
        setError(
          'Your sign-in account was deleted. BeeGreat data cleanup will retry automatically when the app is online.',
        );
      } else if (deletionCancelled) {
        setError(
          user.deleteSelfEnabled
            ? "Couldn't delete your account. No BeeGreat data was erased. Please try again or contact support."
            : 'Account deletion is temporarily unavailable. No BeeGreat data was erased; contact support for help.',
        );
      } else {
        setError(
          "BeeGreat couldn't confirm whether account deletion completed. If your sign-in account was deleted, the signed callback will finish data cleanup in the background. Try signing in again; if that fails, contact support.",
        );
      }
    } finally {
      workingRef.current = false;
      setDeleting(false);
    }
  }, [
    activateBeeGreatDeletion,
    cancelBeeGreatDeletion,
    prepareBeeGreatDeletion,
    revokeAppleBeforeIdentityDeletion,
    signOutIfCurrentUserMatches,
    user,
  ]);

  const requestDeletion = useCallback(() => {
    if (!user || workingRef.current) return;
    setError(null);
    Alert.alert(
      'Delete BeeGreat account?',
      'Before deleting your sign-in account, BeeGreat attempts to revoke any available Sign in with Apple token. It then deletes active-system goals, conversations, Mind, Hive, and connection credentials in the background. Cleanup normally starts immediately when online; safety sweeps may continue for up to 30 days. Public blockchain records, Apple purchase history, and information independently held by connected providers may remain. This cannot be undone.\n\nDeleting BeeGreat does not cancel an active Apple subscription. Manage or cancel it in the App Store first. If BeeGreat cannot access an Apple token, remove BeeGreat in your Apple Account’s Sign in with Apple settings too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => void deleteAccount(),
        },
      ],
    );
  }, [deleteAccount, user]);

  return { deleting, error, requestDeletion };
}
