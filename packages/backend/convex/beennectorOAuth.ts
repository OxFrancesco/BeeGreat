'use node'

import { createHash } from 'node:crypto'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import type {
  BeennectorProvider,
  GoogleWorkspaceService,
} from './beennectorValidators'
import { randomBeennectorValue } from './beennectorCrypto'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_URL = 'https://api.github.com'
const LINEAR_AUTHORIZE_URL = 'https://linear.app/oauth/authorize'
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token'
const LINEAR_API_URL = 'https://api.linear.app/graphql'
const NOTION_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize'
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token'
const NOTION_VERSION = '2026-03-11'
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOCATION_URL = 'https://oauth2.googleapis.com/revoke'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_IDENTITY_SCOPES = [
  'openid',
  'email',
  'profile',
] as const
const GOOGLE_WORKSPACE_SERVICE_SCOPES = {
  mail: ['https://www.googleapis.com/auth/gmail.modify'],
  calendar: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.freebusy',
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/presentations.readonly',
  ],
  contacts: ['https://www.googleapis.com/auth/contacts.readonly'],
  tasks: ['https://www.googleapis.com/auth/tasks'],
  forms: [
    'https://www.googleapis.com/auth/forms.body.readonly',
    'https://www.googleapis.com/auth/forms.responses.readonly',
  ],
} satisfies Record<GoogleWorkspaceService, readonly string[]>

const PROVIDER_CONFIG = {
  github: {
    label: 'GitHub',
    clientId: 'GITHUB_BEENNECTOR_CLIENT_ID',
    clientSecret: 'GITHUB_BEENNECTOR_CLIENT_SECRET',
  },
  linear: {
    label: 'Linear',
    clientId: 'LINEAR_BEENNECTOR_CLIENT_ID',
    clientSecret: 'LINEAR_BEENNECTOR_CLIENT_SECRET',
  },
  notion: {
    label: 'Notion',
    clientId: 'NOTION_BEENNECTOR_CLIENT_ID',
    clientSecret: 'NOTION_BEENNECTOR_CLIENT_SECRET',
  },
  google: {
    label: 'Google Workspace',
    clientId: 'GOOGLE_BEENNECTOR_CLIENT_ID',
    clientSecret: 'GOOGLE_BEENNECTOR_CLIENT_SECRET',
  },
} as const

export type BeennectorIdentity = {
  externalAccountId: string
  externalAccountName?: string
  workspaceId?: string
  workspaceName?: string
  botId?: string
}

export type BeennectorTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scopes: string[]
  identity: BeennectorIdentity
}

export class BeennectorOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = false,
  ) {
    super(message)
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new BeennectorOAuthError(
      `${name} is not configured`,
      'configuration_error',
    )
  }
  return value
}

function credentials(provider: BeennectorProvider) {
  const config = PROVIDER_CONFIG[provider]
  return {
    clientId: requiredEnv(config.clientId),
    clientSecret: requiredEnv(config.clientSecret),
    redirectUri: requiredEnv('BEENNECTOR_OAUTH_REDIRECT_URI'),
  }
}

function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function createBeennectorAuthorization(
  provider: BeennectorProvider,
  googleServices: GoogleWorkspaceService[] = [],
) {
  const { clientId, redirectUri } = credentials(provider)
  const state = randomBeennectorValue()
  const codeVerifier =
    provider === 'notion' ? undefined : randomBeennectorValue(48)
  let url: URL

  if (provider === 'github') {
    url = new URL(GITHUB_AUTHORIZE_URL)
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user repo',
      state,
      code_challenge: pkceChallenge(codeVerifier!),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString()
  } else if (provider === 'linear') {
    url = new URL(LINEAR_AUTHORIZE_URL)
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,comments:create',
      actor: 'user',
      state,
      code_challenge: pkceChallenge(codeVerifier!),
      code_challenge_method: 'S256',
      prompt: 'consent',
    }).toString()
  } else if (provider === 'notion') {
    url = new URL(NOTION_AUTHORIZE_URL)
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    }).toString()
  } else {
    if (googleServices.length === 0) {
      throw new BeennectorOAuthError(
        'Choose at least one Google Workspace service',
        'google_services_required',
        false,
      )
    }
    const requestedScopes = [
      ...GOOGLE_IDENTITY_SCOPES,
      ...googleServices.flatMap(
        (service) => GOOGLE_WORKSPACE_SERVICE_SCOPES[service],
      ),
    ]
    url = new URL(GOOGLE_AUTHORIZE_URL)
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [...new Set(requestedScopes)].join(' '),
      state,
      code_challenge: pkceChallenge(codeVerifier!),
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent select_account',
    }).toString()
  }

  return { authorizationUrl: url.toString(), state, codeVerifier }
}

const tokenBodySchema = Schema.Struct({
  access_token: Schema.optional(Schema.String),
  refresh_token: Schema.optional(Schema.String),
  expires_in: Schema.optional(Schema.Number),
  scope: Schema.optional(
    Schema.Union([Schema.String, Schema.mutable(Schema.Array(Schema.String))]),
  ),
  error: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
  workspace_id: Schema.optional(Schema.String),
  workspace_name: Schema.optional(Schema.String),
  bot_id: Schema.optional(Schema.String),
  owner: Schema.optional(
    Schema.Struct({
      user: Schema.optional(
        Schema.Struct({
          id: Schema.optional(Schema.String),
          name: Schema.optional(Schema.String),
        }),
      ),
    }),
  ),
})
type TokenBody = typeof tokenBodySchema.Type
const decodeTokenBody = Schema.decodeUnknownResult(tokenBodySchema)

async function requestToken(
  provider: BeennectorProvider,
  input: Record<string, string>,
) {
  const { clientId, clientSecret } = credentials(provider)
  const url =
    provider === 'github'
      ? GITHUB_TOKEN_URL
      : provider === 'linear'
        ? LINEAR_TOKEN_URL
        : provider === 'notion'
          ? NOTION_TOKEN_URL
          : GOOGLE_TOKEN_URL
  const notion = provider === 'notion'
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: notion
        ? {
            accept: 'application/json',
            authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'content-type': 'application/json',
            'notion-version': NOTION_VERSION,
          }
        : {
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
          },
      body: notion
        ? JSON.stringify(input)
        : new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            ...input,
          }).toString(),
    })
  } catch {
    throw new BeennectorOAuthError(
      `Could not reach ${PROVIDER_CONFIG[provider].label} OAuth`,
      'network_error',
      true,
    )
  }
  const body = Result.getOrElse(
    decodeTokenBody(await response.json().catch(() => ({}))),
    (): TokenBody => ({}),
  )
  if (!response.ok || !body.access_token) {
    const code = body.error ?? `http_${response.status}`
    const permanent =
      code === 'invalid_grant' ||
      code === 'invalid_client' ||
      code === 'unauthorized_client'
    throw new BeennectorOAuthError(
      body.error_description ??
        body.error ??
        `${PROVIDER_CONFIG[provider].label} token request failed`,
      code,
      !permanent && (response.status === 429 || response.status >= 500),
    )
  }
  return body
}

function scopes(value: TokenBody['scope']) {
  if (Array.isArray(value)) return value
  return value?.split(/[ ,]+/).filter(Boolean) ?? []
}

const gitHubIdentityBodySchema = Schema.Struct({
  id: Schema.optional(Schema.Number),
  login: Schema.optional(Schema.String),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  message: Schema.optional(Schema.String),
})
type GitHubIdentityBody = typeof gitHubIdentityBodySchema.Type
const decodeGitHubIdentityBody = Schema.decodeUnknownResult(
  gitHubIdentityBodySchema,
)

async function fetchGitHubIdentity(
  accessToken: string,
): Promise<BeennectorIdentity> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'x-github-api-version': '2026-03-10',
      'user-agent': 'BeeGreat-Beennector',
    },
  })
  const body = Result.getOrElse(
    decodeGitHubIdentityBody(await response.json().catch(() => ({}))),
    (): GitHubIdentityBody => ({}),
  )
  if (!response.ok || !body.id || !body.login) {
    throw new BeennectorOAuthError(
      body.message ?? 'Could not read the connected GitHub account',
      `github_identity_${response.status}`,
      response.status === 429 || response.status >= 500,
    )
  }
  return {
    externalAccountId: String(body.id),
    externalAccountName: body.login,
  }
}

const linearIdentityNodeSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
})
const linearIdentityBodySchema = Schema.Struct({
  data: Schema.optional(
    Schema.Struct({
      viewer: Schema.optional(linearIdentityNodeSchema),
      organization: Schema.optional(linearIdentityNodeSchema),
    }),
  ),
  errors: Schema.optional(
    Schema.Array(
      Schema.Struct({ message: Schema.optional(Schema.String) }),
    ),
  ),
})
type LinearIdentityBody = typeof linearIdentityBodySchema.Type
const decodeLinearIdentityBody = Schema.decodeUnknownResult(
  linearIdentityBodySchema,
)

async function fetchLinearIdentity(
  accessToken: string,
): Promise<BeennectorIdentity> {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query:
        'query BeennectorIdentity { viewer { id name } organization { id name } }',
    }),
  })
  const body = Result.getOrElse(
    decodeLinearIdentityBody(await response.json().catch(() => ({}))),
    (): LinearIdentityBody => ({}),
  )
  const viewer = body.data?.viewer
  const organization = body.data?.organization
  if (!response.ok || !viewer?.id || !organization?.id) {
    throw new BeennectorOAuthError(
      body.errors?.[0]?.message ??
        'Could not read the connected Linear workspace',
      `linear_identity_${response.status}`,
      response.status === 429 || response.status >= 500,
    )
  }
  return {
    externalAccountId: viewer.id,
    externalAccountName: viewer.name,
    workspaceId: organization.id,
    workspaceName: organization.name,
  }
}

const googleIdentityBodySchema = Schema.Struct({
  sub: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  error_description: Schema.optional(Schema.String),
})
type GoogleIdentityBody = typeof googleIdentityBodySchema.Type
const decodeGoogleIdentityBody = Schema.decodeUnknownResult(
  googleIdentityBodySchema,
)

async function fetchGoogleIdentity(
  accessToken: string,
): Promise<BeennectorIdentity> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  const body = Result.getOrElse(
    decodeGoogleIdentityBody(await response.json().catch(() => ({}))),
    (): GoogleIdentityBody => ({}),
  )
  if (!response.ok || !body.sub || !body.email) {
    throw new BeennectorOAuthError(
      body.error_description ?? 'Could not read the connected Google account',
      `google_identity_${response.status}`,
      response.status === 429 || response.status >= 500,
    )
  }
  return {
    externalAccountId: body.sub,
    externalAccountName: body.email,
    workspaceName: body.name,
  }
}

export async function exchangeBeennectorCode(
  provider: BeennectorProvider,
  code: string,
  codeVerifier?: string,
): Promise<BeennectorTokens> {
  const { redirectUri } = credentials(provider)
  const body = await requestToken(
    provider,
    codeVerifier
      ? {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }
      : {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        },
  )
  const identity = (() => {
    if (provider === 'github') return fetchGitHubIdentity(body.access_token!)
    if (provider === 'linear') return fetchLinearIdentity(body.access_token!)
    if (provider === 'google') return fetchGoogleIdentity(body.access_token!)
    return Promise.resolve({
      externalAccountId:
        body.owner?.user?.id ?? body.bot_id ?? body.workspace_id!,
      externalAccountName: body.owner?.user?.name,
      workspaceId: body.workspace_id,
      workspaceName: body.workspace_name,
      botId: body.bot_id,
    })
  })()
  const resolvedIdentity = await identity
  if (!resolvedIdentity.externalAccountId) {
    throw new BeennectorOAuthError(
      `Could not identify the connected ${PROVIDER_CONFIG[provider].label} account`,
      'missing_identity',
    )
  }
  return {
    accessToken: body.access_token!,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_in
      ? Date.now() + body.expires_in * 1_000
      : undefined,
    scopes: scopes(body.scope),
    identity: resolvedIdentity,
  }
}

export async function refreshBeennectorToken(
  provider: BeennectorProvider,
  refreshToken: string,
) {
  if (provider === 'github') {
    throw new BeennectorOAuthError(
      'GitHub did not issue a refresh token',
      'missing_refresh_token',
    )
  }
  const body = await requestToken(provider, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return {
    accessToken: body.access_token!,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: body.expires_in
      ? Date.now() + body.expires_in * 1_000
      : undefined,
    scopes: scopes(body.scope),
  }
}

export async function revokeBeennectorToken(
  provider: BeennectorProvider,
  accessToken: string,
) {
  const { clientId, clientSecret } = credentials(provider)
  let response: Response
  if (provider === 'github') {
    response = await fetch(`${GITHUB_API_URL}/applications/${clientId}/token`, {
      method: 'DELETE',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/json',
        'x-github-api-version': '2026-03-10',
        'user-agent': 'BeeGreat-Beennector',
      },
      body: JSON.stringify({ access_token: accessToken }),
    })
  } else if (provider === 'linear') {
    response = await fetch('https://api.linear.app/oauth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    })
  } else if (provider === 'notion') {
    response = await fetch('https://api.notion.com/v1/oauth/revoke', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/json',
        'notion-version': NOTION_VERSION,
      },
      body: JSON.stringify({ token: accessToken }),
    })
  } else {
    response = await fetch(GOOGLE_REVOCATION_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken }).toString(),
    })
  }
  if (!response.ok && response.status !== 400 && response.status !== 404) {
    throw new BeennectorOAuthError(
      `${PROVIDER_CONFIG[provider].label} token revocation failed`,
      `revoke_http_${response.status}`,
      response.status === 429 || response.status >= 500,
    )
  }
}
