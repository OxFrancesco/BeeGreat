'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import {
  decryptBeennectorSecret,
  encryptBeennectorSecret,
  hashBeennectorValue,
} from './beennectorCrypto'
import {
  BeennectorOAuthError,
  createBeennectorAuthorization,
  exchangeBeennectorCode,
  refreshBeennectorToken,
  revokeBeennectorToken,
} from './beennectorOAuth'
import {
  beennectorProviderValidator,
  googleWorkspaceServiceValidator,
  type BeennectorProvider,
} from './beennectorValidators'
import { captureHandledConvexException } from './sentryNode'

const SESSION_TTL_MS = 10 * 60 * 1_000
const MIN_ACCESS_VALIDITY_MS = 5 * 60 * 1_000
export const GOOGLE_WORKSPACE_DISCLOSURE_VERSION = '2026-08-13'

function verifierAad(
  userId: string,
  provider: BeennectorProvider,
  stateHash: string,
) {
  return `beennector-session:${userId}:${provider}:${stateHash}:verifier`
}

function credentialAad(
  userId: string,
  provider: BeennectorProvider,
  kind: 'access' | 'refresh',
) {
  return `beennector-credential:${userId}:${provider}:${kind}`
}

export const beginAuthorization = action({
  args: {
    provider: beennectorProviderValidator,
    googleServices: v.optional(v.array(googleWorkspaceServiceValidator)),
    googleDisclosureVersion: v.optional(v.string()),
  },
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    if (
      args.provider === 'google' &&
      args.googleDisclosureVersion !== GOOGLE_WORKSPACE_DISCLOSURE_VERSION
    ) {
      throw new Error('Review and accept the Google Workspace data disclosure.')
    }
    const authorization = createBeennectorAuthorization(
      args.provider,
      args.googleServices,
    )
    const stateHash = hashBeennectorValue(authorization.state)
    await ctx.runMutation(internal.beennectors.createSession, {
      userId,
      provider: args.provider,
      stateHash,
      ...(authorization.codeVerifier
        ? {
            encryptedCodeVerifier: encryptBeennectorSecret(
              authorization.codeVerifier,
              verifierAad(userId, args.provider, stateHash),
            ),
          }
        : {}),
      expiresAt: Date.now() + SESSION_TTL_MS,
      ...(args.provider === 'google'
        ? {
            disclosureVersion: GOOGLE_WORKSPACE_DISCLOSURE_VERSION,
            disclosureAcceptedAt: Date.now(),
            requestedGoogleServices: args.googleServices,
          }
        : {}),
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
  returns: v.object({
    ok: v.boolean(),
    provider: v.optional(beennectorProviderValidator),
    errorCode: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean
    provider?: BeennectorProvider
    errorCode?: string
  }> => {
    const stateHash = hashBeennectorValue(args.state)
    const session: {
      sessionId: Id<'beennectorAuthSessions'>
      userId: string
      provider: BeennectorProvider
      status: string
      encryptedCodeVerifier?: {
        version: 1
        iv: string
        ciphertext: string
        tag: string
      }
      requestedGoogleServices?: Array<
        'mail' | 'calendar' | 'drive' | 'contacts' | 'tasks' | 'forms'
      >
      expiresAt: number
    } | null = await ctx.runQuery(internal.beennectors.getSessionByStateHash, {
      stateHash,
    })
    if (!session) {
      return { ok: false, errorCode: 'invalid_state' }
    }
    if (!args.code || args.errorCode) {
      const errorCode = args.errorCode ?? 'missing_authorization_code'
      await ctx.runMutation(internal.beennectors.failSession, {
        stateHash,
        errorCode,
      })
      return { ok: false, provider: session.provider, errorCode }
    }
    if (
      session.status !== 'pending' ||
      session.expiresAt <= Date.now() ||
      (session.provider !== 'notion' && !session.encryptedCodeVerifier)
    ) {
      await ctx.runMutation(internal.beennectors.failSession, {
        stateHash,
        errorCode: 'invalid_or_expired_state',
      })
      return {
        ok: false,
        provider: session.provider,
        errorCode: 'invalid_or_expired_state',
      }
    }
    try {
      const verifier = session.encryptedCodeVerifier
        ? decryptBeennectorSecret(
            session.encryptedCodeVerifier,
            verifierAad(session.userId, session.provider, stateHash),
          )
        : undefined
      const tokens = await exchangeBeennectorCode(
        session.provider,
        args.code,
        verifier,
      )
      if (session.provider !== 'github' && !tokens.refreshToken) {
        throw new BeennectorOAuthError(
          `${session.provider} did not return a refresh token`,
          'missing_refresh_token',
        )
      }
      const stored: boolean = await ctx.runMutation(
        internal.beennectors.completeAuthorization,
        {
          sessionId: session.sessionId,
          encryptedAccess: encryptBeennectorSecret(
            tokens.accessToken,
            credentialAad(session.userId, session.provider, 'access'),
          ),
          ...(tokens.refreshToken
            ? {
                encryptedRefresh: encryptBeennectorSecret(
                  tokens.refreshToken,
                  credentialAad(session.userId, session.provider, 'refresh'),
                ),
              }
            : {}),
          ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
          scopes: tokens.scopes,
          ...(session.provider === 'google'
            ? { googleServices: session.requestedGoogleServices }
            : {}),
          ...tokens.identity,
        },
      )
      return stored
        ? { ok: true, provider: session.provider }
        : {
            ok: false,
            provider: session.provider,
            errorCode: 'stale_session',
          }
    } catch (error) {
      const errorCode =
        error instanceof BeennectorOAuthError
          ? error.code
          : 'unexpected_error'
      if (
        errorCode === 'configuration_error' ||
        errorCode === 'invalid_client' ||
        errorCode === 'unexpected_error' ||
        (error instanceof BeennectorOAuthError && error.retryable)
      ) {
        await captureHandledConvexException(
          error,
          'beennector.complete_authorization',
          {
            userId: session.userId,
            extra: { provider: session.provider, errorCode },
          },
        )
      }
      await ctx.runMutation(internal.beennectors.failSession, {
        stateHash,
        errorCode,
      })
      return { ok: false, provider: session.provider, errorCode }
    }
  },
})

export const disconnect = action({
  args: { provider: beennectorProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    const userId = identity.subject
    const credential = await ctx.runQuery(
      internal.beennectors.getCredentialForDisconnect,
      { userId, provider: args.provider },
    )
    const encryptedRevocationToken =
      args.provider === 'google'
        ? (credential?.encryptedRefresh ?? credential?.encryptedAccess)
        : credential?.encryptedAccess
    if (encryptedRevocationToken) {
      try {
        const revocationKind =
          args.provider === 'google' && credential?.encryptedRefresh
            ? 'refresh'
            : 'access'
        const token = decryptBeennectorSecret(
          encryptedRevocationToken,
          credentialAad(userId, args.provider, revocationKind),
        )
        await revokeBeennectorToken(args.provider, token)
      } catch (error) {
        await captureHandledConvexException(error, 'beennector.disconnect_revoke', {
          userId,
          extra: { provider: args.provider },
        })
      }
    }
    await ctx.runMutation(internal.beennectors.removeConnection, {
      userId,
      provider: args.provider,
    })
    return null
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

export async function resolveBeennectorAccessToken(
  ctx: ActionCtx,
  userId: string,
  provider: BeennectorProvider,
): Promise<string> {
  const leaseId = crypto.randomUUID()
  const claim: CredentialClaim = await ctx.runMutation(
    internal.beennectors.claimCredential,
    {
      userId,
      provider,
      now: Date.now(),
      leaseId,
      minValidityMs: MIN_ACCESS_VALIDITY_MS,
    },
  )
  if (claim.status === 'missing') {
    throw new Error(
      `${provider} is not connected. Connect it from Profile → Beennectors.`,
    )
  }
  if (claim.status === 'reauth') {
    throw new Error(
      `${provider} must be connected again from Profile → Beennectors.`,
    )
  }
  if (claim.status === 'busy') {
    throw new Error(`${provider} credentials are refreshing. Try again shortly.`)
  }
  if (claim.status === 'ready') {
    return decryptBeennectorSecret(
      claim.encryptedAccess,
      credentialAad(userId, provider, 'access'),
    )
  }
  try {
    const refreshToken = decryptBeennectorSecret(
      claim.encryptedRefresh,
      credentialAad(userId, provider, 'refresh'),
    )
    const tokens = await refreshBeennectorToken(provider, refreshToken)
    const stored = await ctx.runMutation(internal.beennectors.finishRefresh, {
      userId,
      provider,
      leaseId: claim.leaseId,
      encryptedAccess: encryptBeennectorSecret(
        tokens.accessToken,
        credentialAad(userId, provider, 'access'),
      ),
      encryptedRefresh: encryptBeennectorSecret(
        tokens.refreshToken,
        credentialAad(userId, provider, 'refresh'),
      ),
      ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
      scopes: tokens.scopes,
    })
    if (!stored) {
      throw new Error(`${provider} credentials changed while refreshing.`)
    }
    return tokens.accessToken
  } catch (error) {
    const permanent =
      error instanceof BeennectorOAuthError ? !error.retryable : true
    await ctx.runMutation(internal.beennectors.failRefresh, {
      userId,
      provider,
      leaseId: claim.leaseId,
      permanent,
    })
    throw permanent
      ? new Error(
          `${provider} must be connected again from Profile → Beennectors.`,
        )
      : new Error(`${provider} is temporarily unavailable. Try again shortly.`)
  }
}

/**
 * Server-to-server credential handoff for the guarded gog CLI sandbox.
 * The token is never returned by a public Convex function or exposed to the
 * specialist model; the agent worker injects it into one command's env only.
 */
export const googleAccessTokenForAgent = internalAction({
  args: { userId: v.string() },
  returns: v.object({ accessToken: v.string() }),
  handler: async (ctx, args) => ({
    accessToken: await resolveBeennectorAccessToken(ctx, args.userId, 'google'),
  }),
})
