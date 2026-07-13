'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
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

const SESSION_TTL_MS = 10 * 60 * 1000
const MIN_ACCESS_VALIDITY_MS = 5 * 60 * 1000

function verifierAad(userId: string, stateHash: string) {
  return `google-health-session:${userId}:${stateHash}:verifier`
}

function credentialAad(userId: string, kind: 'access' | 'refresh') {
  return `google-health-credential:${userId}:${kind}`
}

export const beginAuthorization = action({
  args: {},
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx) => {
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

export const completeAuthorization = internalAction({
  args: {
    code: v.optional(v.string()),
    state: v.string(),
    errorCode: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), errorCode: v.optional(v.string()) }),
  handler: async (ctx, args): Promise<{ ok: boolean; errorCode?: string }> => {
    const stateHash = hashHealthValue(args.state)
    if (!args.code || args.errorCode) {
      const errorCode = args.errorCode ?? 'missing_authorization_code'
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash,
        errorCode,
      })
      return { ok: false, errorCode }
    }
    const session: {
      sessionId: Id<'googleHealthAuthSessions'>
      userId: string
      status: string
      encryptedCodeVerifier?: {
        version: 1
        iv: string
        ciphertext: string
        tag: string
      }
      expiresAt: number
    } | null = await ctx.runQuery(
      internal.googleHealthAuth.getSessionByStateHash,
      { stateHash },
    )
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now() ||
      !session.encryptedCodeVerifier
    ) {
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash,
        errorCode: 'invalid_or_expired_state',
      })
      return { ok: false, errorCode: 'invalid_or_expired_state' }
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
          sessionId: session.sessionId,
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
      return stored ? { ok: true } : { ok: false, errorCode: 'stale_session' }
    } catch (error) {
      const errorCode =
        error instanceof GoogleHealthOAuthError
          ? error.code
          : 'unexpected_error'
      await ctx.runMutation(internal.googleHealthAuth.failSession, {
        stateHash,
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
  try {
    const refreshToken = decryptHealthSecret(
      claim.encryptedRefresh,
      credentialAad(userId, 'refresh'),
    )
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
      error instanceof GoogleHealthOAuthError ? !error.retryable : true
    await ctx.runMutation(internal.googleHealthAuth.failRefresh, {
      userId,
      leaseId: claim.leaseId,
      permanent,
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
