'use node'

import { isRevokedRefreshCode, isUnconsumedRefreshCode } from './credentialRefreshPolicy'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import {
  decryptHealthSecret,
  encryptHealthSecret,
  hashHealthValue,
} from './googleHealthCrypto'
import {
  createGoogleHealthAuthorization,
  exchangeGoogleHealthCode,
  GoogleHealthOAuthError,
  refreshGoogleHealthToken,
} from './googleHealthOAuth'
import { captureHandledConvexException } from './sentryNode'

const SESSION_TTL_MS = 10 * 60 * 1000
const MIN_ACCESS_VALIDITY_MS = 5 * 60 * 1000

function verifierAad(userId: string, stateHash: string) {
  return `google-health-session:${userId}:${stateHash}:verifier`
}

function credentialAad(userId: string, kind: 'access' | 'refresh') {
  return `google-health-credential:${userId}:${kind}`
}

export const beginAuthorization = action({
  args: { client: v.optional(v.union(v.literal('mobile'), v.literal('browser'))) },
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const enabled = await ctx.runQuery(internal.powerups.checkEnabled, {
      userId,
      powerupId: 'google-health',
    })
    if (!enabled) {
      throw new Error(
        'The Google Health power-up is not enabled. Turn it on first.',
      )
    }
    const authorization = createGoogleHealthAuthorization()
    const stateHash = hashHealthValue(authorization.state)
    await ctx.runMutation(internal.googleHealthAuth.createSession, {
      userId,
      client: args.client ?? 'mobile',
      stateHash,
      encryptedCodeVerifier: encryptHealthSecret(
        authorization.codeVerifier,
        verifierAad(userId, stateHash),
      ),
      expiresAt: Date.now() + SESSION_TTL_MS,
    })
    return { authorizationUrl: authorization.authorizationUrl }
  },
})

export const completeAuthorization = action({
  args: {
    code: v.optional(v.string()),
    state: v.string(),
    errorCode: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), client: v.optional(v.union(v.literal('mobile'), v.literal('browser'))), errorCode: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; client?: 'mobile' | 'browser'; errorCode?: string }> => {
    const completingIdentity = await ctx.auth.getUserIdentity()
    if (!completingIdentity) throw new Error('Sign in to complete this connection')
    const attemptId = crypto.randomUUID()
    const stateHash = hashHealthValue(args.state)
    const session: {
      sessionId: Id<'googleHealthAuthSessions'>
      userId: string
      client: 'mobile' | 'browser'
      status: string
      encryptedCodeVerifier?: {
        version: 1
        iv: string
        ciphertext: string
        tag: string
      }
      expiresAt: number
    } | null = await ctx.runMutation(
      internal.googleHealthAuth.claimSessionByStateHash,
      { stateHash, userId: completingIdentity.subject, attemptId },
    )
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now() ||
      !session.encryptedCodeVerifier
    ) {
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash, attemptId,
        errorCode: 'invalid_or_expired_state',
      })
      return { ok: false, errorCode: 'invalid_or_expired_state' }
    }
    if (!args.code || args.errorCode) {
      const errorCode = args.errorCode ?? 'missing_authorization_code'
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash, attemptId,
        errorCode,
      })
      return { ok: false, errorCode }
    }
    try {
      const verifier = decryptHealthSecret(
        session.encryptedCodeVerifier,
        verifierAad(session.userId, stateHash),
      )
      const tokens = await exchangeGoogleHealthCode(args.code, verifier)
      if (!tokens.refreshToken)
        throw new GoogleHealthOAuthError(
          'Google did not return a refresh token',
          'missing_refresh_token',
        )
      const stored: boolean = await ctx.runMutation(
        internal.googleHealthAuth.completeAuthorization,
        {
          sessionId: session.sessionId, attemptId,
          encryptedAccess: encryptHealthSecret(
            tokens.accessToken,
            credentialAad(session.userId, 'access'),
          ),
          encryptedRefresh: encryptHealthSecret(
            tokens.refreshToken,
            credentialAad(session.userId, 'refresh'),
          ),
          expiresAt: tokens.expiresAt,
          scopes: tokens.scopes,
        },
      )
      return stored ? { ok: true, client: session.client } : { ok: false, errorCode: 'stale_session' }
    } catch (error) {
      const errorCode =
        error instanceof GoogleHealthOAuthError
          ? error.code
          : 'unexpected_error'
      if (
        errorCode === 'configuration_error' ||
        errorCode === 'invalid_client' ||
        errorCode === 'unexpected_error' ||
        (error instanceof GoogleHealthOAuthError && error.retryable)
      ) {
        await captureHandledConvexException(
          error,
          'google_health.complete_authorization',
          { userId: session.userId, extra: { errorCode } },
        )
      }
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash, attemptId,
        errorCode,
      })
      return { ok: false, errorCode }
    }
  },
})

type CredentialClaim =
  | { status: 'missing' }
  | { status: 'reauth' }
  | { status: 'busy'; retryAfterMs: number }
  | {
      status: 'ready'
      encryptedAccess: {
        version: 1
        iv: string
        ciphertext: string
        tag: string
      }
      expiresAt: number
    }
  | {
      status: 'refresh'
      encryptedRefresh: {
        version: 1
        iv: string
        ciphertext: string
        tag: string
      }
      leaseId: string
    }

export async function resolveGoogleHealthAccessToken(
  ctx: ActionCtx,
  userId: string,
): Promise<string> {
  const leaseId = crypto.randomUUID()
  const claim: CredentialClaim = await ctx.runMutation(
    internal.googleHealthAuth.claimCredential,
    {
      userId,
      now: Date.now(),
      leaseId,
      minValidityMs: MIN_ACCESS_VALIDITY_MS,
    },
  )
  if (claim.status === 'missing')
    throw new Error(
      'Google Health is not connected. Connect it from the profile screen.',
    )
  if (claim.status === 'reauth')
    throw new Error(
      'Google Health must be connected again from the profile screen.',
    )
  if (claim.status === 'busy')
    throw new Error(
      'Google Health credentials are refreshing. Try again in a moment.',
    )
  if (claim.status === 'ready') {
    return decryptHealthSecret(
      claim.encryptedAccess,
      credentialAad(userId, 'access'),
    )
  }
  let refreshAttempted = false
  try {
    const refreshToken = decryptHealthSecret(
      claim.encryptedRefresh,
      credentialAad(userId, 'refresh'),
    )
    refreshAttempted = true
    const tokens = await refreshGoogleHealthToken(refreshToken)
    const nextRefresh = tokens.refreshToken ?? refreshToken
    const stored = await ctx.runMutation(
      internal.googleHealthAuth.finishRefresh,
      {
        userId,
        leaseId: claim.leaseId,
        encryptedAccess: encryptHealthSecret(
          tokens.accessToken,
          credentialAad(userId, 'access'),
        ),
        encryptedRefresh: encryptHealthSecret(
          nextRefresh,
          credentialAad(userId, 'refresh'),
        ),
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
      },
    )
    if (!stored)
      throw new Error(
        'Google Health credentials changed while refreshing. Try again.',
      )
    return tokens.accessToken
  } catch (error) {
    const permanent =
      error instanceof GoogleHealthOAuthError && isRevokedRefreshCode(error.code)
    await ctx.runMutation(internal.googleHealthAuth.failRefresh, {
      userId,
      leaseId: claim.leaseId,
      permanent,
      uncertain: refreshAttempted && !permanent && !(error instanceof GoogleHealthOAuthError && isUnconsumedRefreshCode(error.code)),
    })
    throw permanent
      ? new Error(
          'Google Health must be connected again from the profile screen.',
        )
      : new Error(
          'Google Health is temporarily unavailable. Try again shortly.',
        )
  }
}
