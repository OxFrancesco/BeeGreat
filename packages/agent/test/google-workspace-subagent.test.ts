import { describe, expect, test } from 'bun:test'
import type { ISandbox } from '@cloudflare/sandbox'
import {
  executeGoogleWorkspaceCommand,
  googleWorkspaceSubagent,
  googleWorkspaceTools,
  type GoogleWorkspaceOptions,
} from '../src/shared/google-workspace-subagent.ts'

function options(
  exec: ISandbox['exec'],
  getAccessToken: () => Promise<string> = async () => 'access-secret',
): GoogleWorkspaceOptions {
  return {
    userId: 'user_google',
    convexUrl: 'https://bee.convex.cloud',
    runtime: { brokerSecret: 'broker-secret' },
    account: 'bee@example.com',
    sandbox: { exec } as ISandbox,
    getAccessToken,
  }
}

describe('Google Workspace subagent', () => {
  test('mounts one deep gog tool behind the specialist', () => {
    const configured = options(async () => {
      throw new Error('not called')
    })
    expect(googleWorkspaceSubagent(configured).name).toBe('google-workspace')
    expect(googleWorkspaceTools(configured).map((tool) => tool.name)).toEqual([
      'run_gog',
    ])
  })

  test('injects the token only through command env and parses JSON output', async () => {
    let invocation:
      | { command: string; env?: Record<string, string | undefined> }
      | undefined
    const result = await executeGoogleWorkspaceCommand(
      options(async (command, execOptions) => {
        invocation = { command, env: execOptions?.env }
        return {
          success: true,
          exitCode: 0,
          stdout: '{"threads":[{"subject":"Quarterly review"}]}',
          stderr: '',
        } as Awaited<ReturnType<ISandbox['exec']>>
      }),
      ['gmail', 'search', "from:o'hara@example.com"],
    )

    expect(result).toEqual({
      ok: true,
      output: { threads: [{ subject: 'Quarterly review' }] },
    })
    expect(invocation?.command).toContain('/usr/local/bin/gog-agent-safe')
    expect(invocation?.command).toContain(`'from:o'"'"'hara@example.com'`)
    expect(invocation?.command).not.toContain('access-secret')
    expect(invocation?.env?.GOG_ACCESS_TOKEN).toBe('access-secret')
    expect(invocation?.env?.GOG_ACCOUNT).toBe('bee@example.com')
  })

  test('rejects attempts to override BeeGreat safety flags before claiming a token', async () => {
    let tokenClaims = 0
    let executions = 0
    await expect(
      executeGoogleWorkspaceCommand(
        options(
          async () => {
            executions += 1
            throw new Error('not reached')
          },
          async () => {
            tokenClaims += 1
            return 'access-secret'
          },
        ),
        ['--wrap-untrusted=false', 'gmail', 'search', 'in:anywhere'],
      ),
    ).rejects.toThrow('--wrap-untrusted is managed by BeeGreat')
    expect(tokenClaims).toBe(0)
    expect(executions).toBe(0)
  })

  test('redacts credentials if a failed process echoes its environment', async () => {
    await expect(
      executeGoogleWorkspaceCommand(
        options(
          async () =>
            ({
              success: false,
              exitCode: 2,
              stdout: '',
              stderr: 'diagnostic accidentally included access-secret',
            }) as Awaited<ReturnType<ISandbox['exec']>>,
        ),
        ['gmail', 'search', 'newer_than:1d'],
      ),
    ).rejects.toThrow('diagnostic accidentally included [credential redacted]')
  })
})
