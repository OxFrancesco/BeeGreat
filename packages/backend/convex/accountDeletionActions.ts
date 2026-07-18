'use node'

import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, env, internalAction } from './_generated/server'
import {
  AppleSignInRevocationError,
  revokeClerkAppleTokensBeforeDeletion,
} from './appleSignInRevocation'
import type { EncryptedBeennectorSecret } from './beennectorCrypto'
import { decryptBeennectorSecret } from './beennectorCrypto'
import { BeennectorOAuthError, revokeBeennectorToken } from './beennectorOAuth'
import type { BeennectorProvider } from './beennectorValidators'
import type { EncryptedSecret as EncryptedHealthSecret } from './googleHealthCrypto'
import { decryptHealthSecret } from './googleHealthCrypto'
import {
  GoogleHealthOAuthError,
  revokeGoogleHealthToken,
} from './googleHealthOAuth'
import { deleteRevenueCatCustomer } from './revenueCatRest'
import { captureHandledConvexException } from './sentryNode'

type ExternalCleanupPayload = {
  userId: string
  conversationIds: string[]
  googleHealthCredential: {
    encryptedAccess?: EncryptedHealthSecret
    encryptedRefresh?: EncryptedHealthSecret
  } | null
  beennectorCredentials: Array<{
    provider: BeennectorProvider
    encryptedAccess?: EncryptedBeennectorSecret
  }>
}

const FLUE_DELETION_BATCH_SIZE = 200

export const revokeAppleBeforeIdentityDeletion = action({
  args: {
    jobId: v.id('accountDeletionJobs'),
    activationToken: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('revoked'), v.literal('no_token')),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      })
    }
    const prepared: { userId: string } = await ctx.runQuery(
      internal.accountDeletion.authorizeAppleRevocation,
      {
        jobId: args.jobId,
        activationToken: args.activationToken,
        ownerKey: identity.tokenIdentifier,
        userId: identity.subject,
      },
    )
    try {
      const status = await revokeClerkAppleTokensBeforeDeletion(
        prepared.userId,
        env.CLERK_SECRET_KEY,
        {
          clientId: env.APPLE_SIGN_IN_CLIENT_ID,
          teamId: env.APPLE_SIGN_IN_TEAM_ID,
          keyId: env.APPLE_SIGN_IN_KEY_ID,
          privateKey: env.APPLE_SIGN_IN_PRIVATE_KEY,
        },
      )
      await ctx.runMutation(internal.accountDeletion.completeAppleRevocation, {
        jobId: args.jobId,
        activationToken: args.activationToken,
        ownerKey: identity.tokenIdentifier,
        userId: identity.subject,
        status,
      })
      return { status }
    } catch (error) {
      const reason =
        error instanceof AppleSignInRevocationError ? error.reason : 'upstream'
      const retryable =
        error instanceof AppleSignInRevocationError ? error.retryable : true
      await captureHandledConvexException(
        new Error(`Apple deletion preflight failed: ${reason}`),
        'account_delete.apple_revoke',
        {
          userId: identity.subject,
          extra: { reason, retryable },
        },
      )
      throw new ConvexError({
        code: 'APPLE_REVOCATION_UNAVAILABLE',
        message:
          'Account deletion is temporarily unavailable. No account data was erased.',
      })
    }
  },
})

export type FlueDeletionResult =
  | { status: 'deleted' }
  | {
      status: 'unavailable'
      reason: 'configuration' | 'network' | 'upstream'
      retryable: boolean
    }

function credentialAad(
  userId: string,
  provider: BeennectorProvider,
  kind: 'access' | 'refresh',
) {
  return `beennector-credential:${userId}:${provider}:${kind}`
}

function healthCredentialAad(userId: string, kind: 'access' | 'refresh') {
  return `google-health-credential:${userId}:${kind}`
}

/** Calls the private Worker route that clears each known Flue Durable Object. */
export async function deleteFlueConversations(
  baseUrl: string | undefined,
  brokerSecret: string | undefined,
  userId: string,
  conversationIds: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<FlueDeletionResult> {
  const configuredUrl = baseUrl?.trim()
  const configuredSecret = brokerSecret?.trim()
  if (!configuredUrl || !configuredSecret) {
    return {
      status: 'unavailable',
      reason: 'configuration',
      retryable: false,
    }
  }
  let endpoint: URL
  try {
    endpoint = new URL('/internal/account-deletion', configuredUrl)
  } catch {
    return {
      status: 'unavailable',
      reason: 'configuration',
      retryable: false,
    }
  }
  const uniqueConversationIds = [...new Set(conversationIds)]
  for (
    let index = 0;
    index < uniqueConversationIds.length;
    index += FLUE_DELETION_BATCH_SIZE
  ) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let response: Response
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${configuredSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          conversationIds: uniqueConversationIds.slice(
            index,
            index + FLUE_DELETION_BATCH_SIZE,
          ),
        }),
        signal: controller.signal,
      })
    } catch {
      return { status: 'unavailable', reason: 'network', retryable: true }
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok) {
      return {
        status: 'unavailable',
        reason: 'upstream',
        retryable: response.status === 429 || response.status >= 500,
      }
    }
  }
  return { status: 'deleted' }
}

async function captureCleanupFailure(
  error: unknown,
  operation: string,
  userId: string,
  extra?: Record<string, unknown>,
) {
  await captureHandledConvexException(error, operation, { userId, extra })
}

export const cleanup = internalAction({
  args: { jobId: v.id('accountDeletionJobs') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payload: ExternalCleanupPayload | null = await ctx.runQuery(
      internal.accountDeletion.getExternalCleanupPayload,
      { jobId: args.jobId },
    )
    if (!payload) return null

    let retryableFailure = false
    const revenueCat = await deleteRevenueCatCustomer(
      payload.userId,
      env.REVENUECAT_SECRET_API_KEY,
    )
    if (revenueCat.status === 'unavailable') {
      retryableFailure ||= revenueCat.retryable
      if (revenueCat.reason !== 'configuration') {
        await captureCleanupFailure(
          new Error(`RevenueCat deletion failed: ${revenueCat.reason}`),
          'account_delete.revenuecat',
          payload.userId,
          { reason: revenueCat.reason },
        )
      }
    }

    const flue = await deleteFlueConversations(
      env.AGENT_URL,
      env.AGENT_CREDENTIAL_BROKER_SECRET,
      payload.userId,
      payload.conversationIds,
    )
    if (flue.status === 'unavailable') {
      retryableFailure ||= flue.retryable
      if (flue.reason !== 'configuration') {
        await captureCleanupFailure(
          new Error(`Flue deletion failed: ${flue.reason}`),
          'account_delete.flue',
          payload.userId,
          { reason: flue.reason },
        )
      }
    }

    const healthCredential = payload.googleHealthCredential
    const encryptedHealthToken =
      healthCredential?.encryptedRefresh ?? healthCredential?.encryptedAccess
    if (encryptedHealthToken) {
      const kind = healthCredential?.encryptedRefresh ? 'refresh' : 'access'
      try {
        const token = decryptHealthSecret(
          encryptedHealthToken,
          healthCredentialAad(payload.userId, kind),
        )
        await revokeGoogleHealthToken(token)
      } catch (error) {
        retryableFailure ||=
          error instanceof GoogleHealthOAuthError ? error.retryable : true
        await captureCleanupFailure(
          error,
          'account_delete.google_health',
          payload.userId,
        )
      }
    }

    for (const credential of payload.beennectorCredentials) {
      if (!credential.encryptedAccess) continue
      try {
        const token = decryptBeennectorSecret(
          credential.encryptedAccess,
          credentialAad(payload.userId, credential.provider, 'access'),
        )
        await revokeBeennectorToken(credential.provider, token)
      } catch (error) {
        retryableFailure ||=
          error instanceof BeennectorOAuthError ? error.retryable : true
        await captureCleanupFailure(
          error,
          'account_delete.beennector',
          payload.userId,
          { provider: credential.provider },
        )
      }
    }

    await ctx.runMutation(internal.accountDeletion.finishExternalCleanup, {
      jobId: args.jobId,
      retryableFailure,
    })
    return null
  },
})
