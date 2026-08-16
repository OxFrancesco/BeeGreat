import { api } from '@beegreat/backend/convex/_generated/api';
import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { eoaFailureReason } from '@beegreat/tool-presentation';
import {
  sameEvmAddress,
  sendFreshEoaTransactions,
} from '@beegreat/wallet-connect';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useEoaWallet } from '@/hooks/use-eoa-wallet';
import { useTheme } from '@/hooks/use-theme';

import { sharedStyles } from './shared';

/**
 * Web3 money movement uses an action-bound authorization. Smart-wallet actions
 * call `web3Actions.confirm` and schedule server-side execution; linked-wallet
 * actions claim the exact plan and leave every signature in the connected EOA.
 * Free-form chat text cannot move funds. YOLO may auto-approve only smart-wallet
 * actions, in which case the card shows live progress instead of buttons.
 */
export function Web3ConfirmCard({
  summary,
  actionId,
  onReply,
}: {
  summary: string;
  actionId: string;
  onReply?: (text: string) => void;
}) {
  const theme = useTheme();
  const confirmAction = useMutation(api.web3Actions.confirm);
  const cancelAction = useMutation(api.web3Actions.cancel);
  const beginEoaExecution = useMutation(api.web3Actions.beginEoaExecution);
  const refreshEoaExecution = useAction(api.web3.refreshEoaSugarExecution);
  const recordEoaSubmission = useMutation(api.web3Actions.recordEoaSubmission);
  const recordEoaReceipt = useMutation(api.web3Actions.recordEoaReceipt);
  const reportEoaFailure = useMutation(api.web3Actions.reportEoaFailure);
  const connectedWallet = useEoaWallet();
  const [decision, setDecision] = useState<
    'idle' | 'working' | 'confirmed' | 'declined'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  // The status query is ownership-scoped (null for anyone else), so it is
  // safe to subscribe immediately — needed to detect YOLO auto-confirmation.
  const live = useQuery(api.web3Actions.status, {
    actionId: actionId as Id<'web3Actions'>,
  });
  const autoConfirmed = live?.autoConfirmed === true;
  const isEoaAction = live?.kind === 'execute_eoa_plan';
  const expectedEoaAddress = live?.eoaRequest?.walletAddress;
  const eoaSessionMatches = Boolean(
    expectedEoaAddress &&
    connectedWallet.address &&
    connectedWallet.provider &&
    sameEvmAddress(expectedEoaAddress, connectedWallet.address),
  );

  const confirm = async () => {
    if (decision !== 'idle') return;
    if (isEoaAction && !eoaSessionMatches) {
      setError(null);
      try {
        if (connectedWallet.isConnected) await connectedWallet.disconnect();
        await connectedWallet.connect();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Couldn’t open WalletConnect.',
        );
      }
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setDecision('working');
    setError(null);
    let eoaClaimed = false;
    try {
      if (isEoaAction) {
        const plan = await beginEoaExecution({
          actionId: actionId as Id<'web3Actions'>,
        });
        eoaClaimed = true;
        try {
          await sendFreshEoaTransactions({
            provider: connectedWallet.provider!,
            address: plan.walletAddress,
            chainId: plan.chainId,
            buildPlan: async () => {
              const refreshed = await refreshEoaExecution({
                actionId: actionId as Id<'web3Actions'>,
              });
              return refreshed.transactionSteps;
            },
            onSubmitted: async ({ index, hash, role }) => {
              await recordEoaSubmission({
                actionId: actionId as Id<'web3Actions'>,
                index,
                hash,
                role,
              });
            },
            onConfirmed: async ({ index, hash }) => {
              await recordEoaReceipt({
                actionId: actionId as Id<'web3Actions'>,
                index,
                hash,
              });
            },
          });
        } catch (cause) {
          await reportEoaFailure({
            actionId: actionId as Id<'web3Actions'>,
            reason: eoaFailureReason(cause),
          });
          throw cause;
        }
      } else {
        await confirmAction({ actionId: actionId as Id<'web3Actions'> });
      }
      setDecision('confirmed');
      onReply?.(
        isEoaAction
          ? 'I signed the linked-wallet action in the app. Check its status.'
          : 'I confirmed the action in the app. Check its status.',
      );
    } catch (cause) {
      setDecision(
        isEoaAction && eoaClaimed
          ? eoaFailureReason(cause) === 'user_rejected'
            ? 'declined'
            : 'confirmed'
          : 'idle',
      );
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t confirm the action.',
      );
    }
  };

  const decline = () => {
    if (decision !== 'idle') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDecision('declined');
    cancelAction({ actionId: actionId as Id<'web3Actions'> }).catch(() => {
      // Cancelling a stale or unknown action is a no-op.
    });
    onReply?.('No, I declined the action.');
  };

  const status = live?.status;
  const explorerLink =
    live?.socketProgress?.destinationExplorerLink ??
    [...(live?.result ?? [])].reverse().find((item) => item.explorerLink)
      ?.explorerLink;
  // YOLO auto-approval resolves the card without a tap; show progress
  // immediately instead of confirm buttons.
  const resolved =
    decision === 'confirmed' ||
    autoConfirmed ||
    (isEoaAction && status !== undefined && status !== 'pending');
  const loading = live === undefined;

  return (
    <View
      style={[
        sharedStyles.card,
        {
          backgroundColor: theme.card,
          borderColor:
            autoConfirmed || isEoaAction ? theme.primary : theme.destructive,
        },
      ]}
    >
      <ThemedText
        type="smallBold"
        themeColor={autoConfirmed || isEoaAction ? 'primary' : 'destructive'}
      >
        {autoConfirmed
          ? 'Auto-approved · YOLO mode'
          : isEoaAction
            ? 'Needs your wallet signature'
            : 'Needs your confirmation'}
      </ThemedText>
      <ThemedText selectable>{summary}</ThemedText>
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
      {decision === 'declined' || status === 'cancelled' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Declined — nothing was sent.
        </ThemedText>
      ) : resolved ? (
        status === 'executed' ? (
          <View style={sharedStyles.confirmRow}>
            <ThemedText type="smallBold">Done ✓</ThemedText>
            {explorerLink ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(explorerLink)}
                style={({ pressed }) => pressed && sharedStyles.taskRowPressed}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">
                  View transaction ↗
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : status === 'failed' ? (
          <ThemedText
            type="small"
            themeColor="destructive"
            accessibilityLiveRegion="polite"
          >
            {live?.error ?? 'Execution failed.'}
          </ThemedText>
        ) : status === 'refunded' ? (
          <ThemedText type="small" accessibilityLiveRegion="polite">
            The route was refunded.
          </ThemedText>
        ) : status === 'expired' ? (
          <ThemedText
            type="small"
            themeColor="destructive"
            accessibilityLiveRegion="polite"
          >
            This confirmation expired before execution.
          </ThemedText>
        ) : (
          <View style={sharedStyles.confirmRow}>
            <ActivityIndicator size="small" />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLiveRegion="polite"
            >
              {status === 'in_progress'
                ? isEoaAction
                  ? `${live?.result?.length ?? 0} of ${live?.eoaRequest?.stepCount ?? 1} transactions submitted…`
                  : (live?.socketProgress?.detail ?? 'Moving funds…')
                : isEoaAction
                  ? 'Check your wallet to sign each transaction…'
                  : 'Confirmed — preparing…'}
            </ThemedText>
          </View>
        )
      ) : loading ? (
        // Wait for the first status read so an auto-approved action never
        // flashes confirm buttons.
        <View style={sharedStyles.confirmRow}>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <View style={sharedStyles.confirmRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm in app"
            disabled={decision === 'working'}
            onPress={() => void confirm()}
            style={({ pressed }) => [
              sharedStyles.confirmButton,
              { backgroundColor: theme.primary },
              (pressed || decision === 'working') &&
                sharedStyles.taskRowPressed,
            ]}
          >
            {decision === 'working' ? (
              <ActivityIndicator size="small" color={theme.primaryForeground} />
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: theme.primaryForeground }}
              >
                {isEoaAction && !eoaSessionMatches
                  ? 'Connect wallet'
                  : 'Confirm'}
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decline"
            disabled={decision === 'working'}
            onPress={decline}
            style={({ pressed }) => [
              sharedStyles.confirmButton,
              sharedStyles.confirmButtonOutline,
              { borderColor: theme.border },
              pressed && sharedStyles.taskRowPressed,
            ]}
          >
            <ThemedText type="smallBold">No</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}
