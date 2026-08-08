'use node'

import { v } from 'convex/values'
import type { ActionCtx } from './_generated/server'
import { action, internalAction } from './_generated/server'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  decryptTelegramSecret,
  encryptTelegramSecret,
  hashTelegramValue,
  type EncryptedTelegramSecret,
} from './telegramCrypto'
import {
  createTelegramAuthorization,
  exchangeTelegramCode,
  TelegramOAuthError,
} from './telegramOAuth'
import { sendTelegramBotMessage, TelegramBotError } from './telegramBot'
import { captureHandledConvexException } from './sentryNode'

const SESSION_TTL_MS = 10 * 60 * 1000

function sessionAad(
  userId: string,
  stateHash: string,
  kind: 'verifier' | 'nonce',
) {
  return `telegram-session:${userId}:${stateHash}:${kind}`
}

async function createAuthorizationSession(
  ctx: ActionCtx,
  userId: string,
  client: 'mobile' | 'browser',
) {
  const authorization = createTelegramAuthorization()
  const stateHash = hashTelegramValue(authorization.state)
  await ctx.runMutation(internal.telegram.createSession, {
    userId,
    client,
    stateHash,
    encryptedCodeVerifier: encryptTelegramSecret(
      authorization.codeVerifier,
      sessionAad(userId, stateHash, 'verifier'),
    ),
    encryptedNonce: encryptTelegramSecret(
      authorization.nonce,
      sessionAad(userId, stateHash, 'nonce'),
    ),
    expiresAt: Date.now() + SESSION_TTL_MS,
  })
  return { authorizationUrl: authorization.authorizationUrl }
}

export const beginAuthorization = action({
  args: {
    client: v.union(v.literal('mobile'), v.literal('browser')),
  },
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    return await createAuthorizationSession(ctx, identity.subject, args.client)
  },
})

export const beginAuthorizationForAgent = internalAction({
  args: {
    userId: v.string(),
    client: v.union(v.literal('mobile'), v.literal('browser')),
  },
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx, args) =>
    await createAuthorizationSession(ctx, args.userId, args.client),
})

export const completeAuthorization = internalAction({
  args: {
    code: v.optional(v.string()),
    state: v.string(),
    errorCode: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    client: v.optional(v.union(v.literal('mobile'), v.literal('browser'))),
    errorCode: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean
    client?: 'mobile' | 'browser'
    errorCode?: string
  }> => {
    const stateHash = hashTelegramValue(args.state)
    const session: {
      sessionId: Id<'telegramAuthSessions'>
      userId: string
      client: 'mobile' | 'browser'
      status: string
      encryptedCodeVerifier?: EncryptedTelegramSecret
      encryptedNonce?: EncryptedTelegramSecret
      expiresAt: number
    } | null = await ctx.runQuery(internal.telegram.getSessionByStateHash, {
      stateHash,
    })
    if (
      !session ||
      session.status !== 'pending' ||
      session.expiresAt <= Date.now()
    ) {
      await ctx.runMutation(internal.telegram.failSession, {
        stateHash,
        errorCode: 'invalid_or_expired_state',
      })
      return { ok: false, errorCode: 'invalid_or_expired_state' }
    }
    if (!args.code || args.errorCode) {
      const errorCode = args.errorCode ?? 'missing_authorization_code'
      await ctx.runMutation(internal.telegram.failSession, {
        stateHash,
        errorCode,
      })
      return { ok: false, client: session.client, errorCode }
    }
    if (!session.encryptedCodeVerifier || !session.encryptedNonce) {
      await ctx.runMutation(internal.telegram.failSession, {
        stateHash,
        errorCode: 'invalid_session',
      })
      return {
        ok: false,
        client: session.client,
        errorCode: 'invalid_session',
      }
    }
    try {
      const identity = await exchangeTelegramCode(
        args.code,
        decryptTelegramSecret(
          session.encryptedCodeVerifier,
          sessionAad(session.userId, stateHash, 'verifier'),
        ),
        decryptTelegramSecret(
          session.encryptedNonce,
          sessionAad(session.userId, stateHash, 'nonce'),
        ),
      )
      const stored: boolean = await ctx.runMutation(
        internal.telegram.completeAuthorization,
        { sessionId: session.sessionId, ...identity },
      )
      return stored
        ? { ok: true, client: session.client }
        : { ok: false, client: session.client, errorCode: 'stale_session' }
    } catch (error) {
      const errorCode =
        error instanceof TelegramOAuthError ? error.code : 'unexpected_error'
      await captureHandledConvexException(
        error,
        'telegram.complete_authorization',
        { userId: session.userId, extra: { errorCode } },
      )
      await ctx.runMutation(internal.telegram.failSession, {
        stateHash,
        errorCode,
      })
      return { ok: false, client: session.client, errorCode }
    }
  },
})

async function sendConnectedMessage(
  ctx: ActionCtx,
  userId: string,
  text: string,
  silent: boolean,
): Promise<{ messageId: number }> {
  const connection:
    | { status: 'missing' }
    | { status: 'pending' }
    | { status: 'failed'; message: string }
    | { status: 'needs_reauth' }
    | {
        status: 'connected'
        telegramUserId: string
        displayName: string
        username?: string
      } = await ctx.runQuery(internal.telegram.getConnectionForAgent, {
    userId,
  })
  if (connection.status === 'missing') {
    throw new Error('Telegram is not connected. Connect it from Profile.')
  }
  if (connection.status === 'pending') {
    throw new Error('Telegram is still waiting for connection approval.')
  }
  if (connection.status === 'failed') {
    throw new Error(connection.message)
  }
  if (connection.status === 'needs_reauth') {
    throw new Error('Telegram needs to be reconnected from Profile.')
  }
  try {
    return await sendTelegramBotMessage(
      connection.telegramUserId,
      text,
      silent,
    )
  } catch (error) {
    if (error instanceof TelegramBotError && error.permissionDenied) {
      await ctx.runMutation(internal.telegram.markNeedsReauth, { userId })
    }
    throw error
  }
}

function validateMessage(text: string) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Telegram message cannot be empty.')
  if ([...trimmed].length > 4096) {
    throw new Error('Telegram messages must be 4,096 characters or fewer.')
  }
  return trimmed
}

export const sendMessage = action({
  args: { text: v.string(), silent: v.optional(v.boolean()) },
  returns: v.object({ messageId: v.number() }),
  handler: async (ctx, args): Promise<{ messageId: number }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Not signed in')
    return await sendConnectedMessage(
      ctx,
      identity.subject,
      validateMessage(args.text),
      args.silent ?? false,
    )
  },
})

export const sendForAgent = internalAction({
  args: {
    userId: v.string(),
    text: v.string(),
    silent: v.optional(v.boolean()),
  },
  returns: v.object({ messageId: v.number() }),
  handler: async (ctx, args): Promise<{ messageId: number }> =>
    await sendConnectedMessage(
      ctx,
      args.userId,
      validateMessage(args.text),
      args.silent ?? false,
    ),
})
