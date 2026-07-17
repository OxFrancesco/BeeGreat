import { describe, expect, test } from 'vitest'
import { createDevinClient } from './devinClient'

const sessionResponse = {
  session_id: 'devin-abc123',
  url: 'https://app.devin.ai/sessions/devin-abc123',
  title: 'Repair login',
  status: 'running',
  status_detail: 'working',
  pull_requests: [
    { pr_url: 'https://github.com/acme/app/pull/42', pr_state: 'open' },
  ],
  created_at: 1_700_000_000,
  updated_at: 1_700_000_010,
}

describe('Devin v3 client', () => {
  test('creates a resumable, tagged organization session without exposing the key', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify(sessionResponse), { status: 200 })
    }
    const client = createDevinClient(
      { apiKey: 'cog_secret', orgId: 'org-test' },
      fetchImpl as typeof fetch,
    )

    const session = await client.createSession({
      prompt: 'Fix the login bug and add tests.',
      title: 'Repair login',
      repos: ['acme/app'],
      mode: 'normal',
      maxAcuLimit: 12,
    })

    expect(session).toMatchObject({
      sessionId: 'devin-abc123',
      status: 'running',
      statusDetail: 'working',
      pullRequests: [
        { url: 'https://github.com/acme/app/pull/42', state: 'open' },
      ],
    })
    expect(calls[0]?.url).toBe(
      'https://api.devin.ai/v3/organizations/org-test/sessions',
    )
    expect(calls[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer cog_secret',
    })
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      prompt: 'Fix the login bug and add tests.',
      title: 'Repair login',
      repos: ['acme/app'],
      devin_mode: 'normal',
      max_acu_limit: 12,
      resumable: true,
      tags: ['beegreat'],
    })
  })

  test('sends follow-ups to the same session', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return new Response(JSON.stringify(sessionResponse), { status: 200 })
    }
    const client = createDevinClient(
      { apiKey: 'cog_secret', orgId: 'org-test' },
      fetchImpl as typeof fetch,
    )

    await client.sendMessage('devin-abc123', 'Please add regression tests.')

    expect(calls[0]?.url.endsWith('/sessions/devin-abc123/messages')).toBe(true)
    expect(calls[0]?.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      message: 'Please add regression tests.',
    })
  })

  test('returns a useful API validation error', async () => {
    const client = createDevinClient(
      { apiKey: 'cog_secret', orgId: 'org-test' },
      (async () =>
        new Response(
          JSON.stringify({ detail: [{ msg: 'Repository is not available' }] }),
          { status: 422 },
        )) as typeof fetch,
    )

    await expect(client.getSession('devin-missing')).rejects.toThrow(
      'Repository is not available',
    )
  })
})
