'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import {
  decryptSecret,
  encryptSecret,
  hashAccountId,
} from './chatgptCrypto'
import {
  exchangeDeviceAuthorization,
  OpenAiCodexAuthError,
  pollDeviceAuthorization as pollOpenAiDeviceAuthorization,
  refreshCredentials,
  startDeviceAuthorization,
} from './chatgptOpenAi'
import { agentCredentialResultValidator } from './chatgptAuthValidators'
import { captureHandledConvexException } from './sentryNode'

const MIN_ACCESS_VALIDITY_MS = 5 * 60 * 1000
const SLOW_DOWN_INCREMENT_MS = 5_000
const MAX_POLL_RETRY_MS = 30_000

type AgentCredentialResult =
  | { status: 'missing' }
  | { status: 'reauth' }
  | { status: 'busy'; retryAfterMs: number }
  | { status: 'unavailable'; retryAfterMs: number }
  | { status: 'ok'; accessToken: string; expiresAt: number }

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

function sessionDeviceAad(sessionId: string) {
  return `chatgpt-auth-session:${sessionId}:device-auth-id`
}

function credentialAad(userId: string, kind: 'access' | 'refresh') {
  return `chatgpt-credential:${userId}:${kind}`
}

function errorCode(error: unknown) {
  if (error instanceof OpenAiCodexAuthError) return error.code
  if (
    error instanceof Error &&
    (error.message.includes('CHATGPT_CREDENTIALS_KEY') ||
      error.message.includes('credential encryption'))
  ) {
    return 'configuration_error'
  }
  return 'unexpected_error'
}

export const beginDeviceAuthorization = internalAction({
  args: { sessionId: v.id('chatgptAuthSessions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(internal.chatgptAuth.getSessionForPolling, {
      sessionId: args.sessionId,
    })
    if (!session || session.status !== 'starting') return null
    try {
      const device = await startDeviceAuthorization()
      await ctx.runMutation(internal.chatgptAuth.markPendingAndSchedule, {
        sessionId: args.sessionId,
        encryptedDeviceAuthId: encryptSecret(
          device.deviceAuthId,
          sessionDeviceAad(args.sessionId),
        ),
        userCode: device.userCode,
        verificationUri: device.verificationUri,
        intervalMs: device.intervalMs,
        expiresAt: device.expiresAt,
      })
    } catch (error) {
      const code = errorCode(error)
      if (code === 'configuration_error' || code === 'unexpected_error') {
        await captureHandledConvexException(
          error,
          'chatgpt.begin_device_authorization',
        )
      }
      await ctx.runMutation(internal.chatgptAuth.markSessionFailure, {
        sessionId: args.sessionId,
        status: 'failed',
        errorCode: code,
      })
    }
    return null
  },
})

export const pollDeviceAuthorization = internalAction({
  args: { sessionId: v.id('chatgptAuthSessions') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(internal.chatgptAuth.getSessionForPolling, {
      sessionId: args.sessionId,
    })
    if (!session || session.status !== 'pending') return null
    if (session.expiresAt <= Date.now()) {
      await ctx.runMutation(internal.chatgptAuth.markSessionFailure, {
        sessionId: args.sessionId,
        status: 'expired',
        errorCode: 'expired',
      })
      return null
    }
    if (!session.encryptedDeviceAuthId || !session.userCode) {
      await ctx.runMutation(internal.chatgptAuth.markSessionFailure, {
        sessionId: args.sessionId,
        status: 'failed',
        errorCode: 'invalid_session_state',
      })
      return null
    }

    try {
      const deviceAuthId = decryptSecret(
        session.encryptedDeviceAuthId,
        sessionDeviceAad(args.sessionId),
      )
      const result = await pollOpenAiDeviceAuthorization(deviceAuthId, session.userCode)
      if (result.status === 'pending' || result.status === 'slow_down') {
        const baseDelay = session.intervalMs ?? 5_000
        await ctx.runMutation(internal.chatgptAuth.scheduleNextPoll, {
          sessionId: args.sessionId,
          delayMs:
            result.status === 'slow_down'
              ? Math.min(baseDelay + SLOW_DOWN_INCREMENT_MS, MAX_POLL_RETRY_MS)
              : baseDelay,
        })
        return null
      }

      const credentials = await exchangeDeviceAuthorization(
        result.authorizationCode,
        result.codeVerifier,
      )
      await ctx.runMutation(internal.chatgptAuth.completeAuthorization, {
        sessionId: args.sessionId,
        encryptedAccess: encryptSecret(
          credentials.access,
          credentialAad(session.userId, 'access'),
        ),
        encryptedRefresh: encryptSecret(
          credentials.refresh,
          credentialAad(session.userId, 'refresh'),
        ),
        expiresAt: credentials.expiresAt,
        accountIdHash: hashAccountId(credentials.accountId),
      })
    } catch (error) {
      if (error instanceof OpenAiCodexAuthError && error.retryable) {
        const exponentialDelay = Math.min(
          (session.intervalMs ?? 5_000) * 2 ** Math.min(session.attemptCount, 3),
          MAX_POLL_RETRY_MS,
        )
        await ctx.runMutation(internal.chatgptAuth.scheduleNextPoll, {
          sessionId: args.sessionId,
          delayMs: exponentialDelay,
        })
      } else {
        const code = errorCode(error)
        if (code === 'configuration_error' || code === 'unexpected_error') {
          await captureHandledConvexException(
            error,
            'chatgpt.poll_device_authorization',
            { userId: session.userId },
          )
        }
        await ctx.runMutation(internal.chatgptAuth.markSessionFailure, {
          sessionId: args.sessionId,
          status: 'failed',
          errorCode: code,
        })
      }
    }
    return null
  },
})

export const resolveForAgent = internalAction({
  args: { userId: v.string() },
  returns: agentCredentialResultValidator,
  handler: async (ctx, args): Promise<AgentCredentialResult> => {
    const leaseId = crypto.randomUUID()
    const claim: CredentialClaim = await ctx.runMutation(
      internal.chatgptAuth.claimCredential,
      {
        userId: args.userId,
        now: Date.now(),
        leaseId,
        minValidityMs: MIN_ACCESS_VALIDITY_MS,
      },
    )
    if (claim.status === 'missing' || claim.status === 'reauth') return claim
    if (claim.status === 'busy') {
      return {
        status: 'busy' as const,
        retryAfterMs: Math.min(claim.retryAfterMs, 2_000),
      }
    }
    if (claim.status === 'ready') {
      try {
        return {
          status: 'ok' as const,
          accessToken: decryptSecret(
            claim.encryptedAccess,
            credentialAad(args.userId, 'access'),
          ),
          expiresAt: claim.expiresAt,
        }
      } catch (error) {
        await captureHandledConvexException(
          error,
          'chatgpt.decrypt_access_credential',
          { userId: args.userId },
        )
        return { status: 'reauth' as const }
      }
    }

    try {
      const refreshToken = decryptSecret(
        claim.encryptedRefresh,
        credentialAad(args.userId, 'refresh'),
      )
      const credentials = await refreshCredentials(refreshToken)
      const stored = await ctx.runMutation(internal.chatgptAuth.finishRefresh, {
        userId: args.userId,
        leaseId: claim.leaseId,
        encryptedAccess: encryptSecret(
          credentials.access,
          credentialAad(args.userId, 'access'),
        ),
        encryptedRefresh: encryptSecret(
          credentials.refresh,
          credentialAad(args.userId, 'refresh'),
        ),
        expiresAt: credentials.expiresAt,
        accountIdHash: hashAccountId(credentials.accountId),
      })
      if (!stored) return { status: 'busy' as const, retryAfterMs: 250 }
      return {
        status: 'ok' as const,
        accessToken: credentials.access,
        expiresAt: credentials.expiresAt,
      }
    } catch (error) {
      if (!(error instanceof OpenAiCodexAuthError)) {
        await captureHandledConvexException(
          error,
          'chatgpt.refresh_credential',
          { userId: args.userId },
        )
      }
      const permanent =
        error instanceof OpenAiCodexAuthError ? !error.retryable : true
      await ctx.runMutation(internal.chatgptAuth.failRefresh, {
        userId: args.userId,
        leaseId: claim.leaseId,
        permanent,
      })
      return permanent
        ? { status: 'reauth' as const }
        : { status: 'unavailable' as const, retryAfterMs: 1_000 }
    }
  },
})
