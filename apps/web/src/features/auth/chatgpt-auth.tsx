import { api } from '@beegreat/backend/convex/_generated/api'
import { useClerk } from '@clerk/tanstack-react-start'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import type { FunctionReturnType } from 'convex/server'
import type { PropsWithChildren } from 'react'

type ChatGptStatus = FunctionReturnType<typeof api.chatgptAuth.status>

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.append(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
}

function authError(cause: unknown) {
  if (cause instanceof Error && cause.message.includes('ALREADY_CONNECTED')) {
    return 'ChatGPT is already connected.'
  }
  return 'Could not update the ChatGPT connection. Try again.'
}

function useChatGptActions() {
  const start = useMutation(api.chatgptAuth.start)
  const disconnect = useMutation(api.chatgptAuth.disconnect)
  const skip = useMutation(api.chatgptAuth.skip)
  const [working, setWorking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>()

  async function run(operation: () => Promise<unknown>) {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      await operation()
    } catch (cause) {
      setError(authError(cause))
    } finally {
      setWorking(false)
    }
  }

  return {
    working,
    copied,
    error,
    connect: () => run(() => start({})),
    disconnect: () => run(() => disconnect({})),
    skip: () => run(() => skip({})),
    copyCode: async (code: string) => {
      await copyText(code)
      setCopied(true)
    },
    copyAndOpen: (status: ChatGptStatus) => {
      const userCode = status.userCode
      const verificationUri = status.verificationUri
      if (working || !userCode || !verificationUri) return
      // Open synchronously during the click gesture, before clipboard access
      // yields, so strict popup blockers do not discard the auth window.
      const popup = window.open(
        'about:blank',
        'beegreat-chatgpt',
        'popup,width=680,height=780',
      )
      if (!popup) {
        setError('Allow pop-ups to connect ChatGPT.')
        return
      }
      popup.opener = null
      let navigated = false
      return run(async () => {
        await copyText(userCode)
        setCopied(true)
        navigated = true
        popup.location.assign(verificationUri)
      }).finally(() => {
        if (!navigated) popup.close()
      })
    },
  }
}

export function ChatGptAuthGate({ children }: PropsWithChildren) {
  const status = useQuery(api.chatgptAuth.status)
  const { signOut } = useClerk()
  const actions = useChatGptActions()

  if (!status) {
    return (
      <div className="auth-gate auth-gate--loading">Gathering your Hive…</div>
    )
  }
  if (status.state === 'connected' || status.skipped) return children

  const pending = status.state === 'pending' && Boolean(status.userCode)
  const starting = status.state === 'starting'
  return (
    <main className="auth-gate">
      <div className="auth-gate__comb-field" aria-hidden="true" />
      <section className="auth-gate__card">
        <img className="auth-gate__bee" src={beeUrl} alt="" />
        <p className="utility-label">Optional connection</p>
        <h1>Bee, meet ChatGPT.</h1>
        <p>
          Connect your ChatGPT plan through Codex, or keep using BeeGreat’s
          built-in model.
        </p>

        {starting ? (
          <p className="status-line">Creating a secure device code…</p>
        ) : null}
        {pending && status.userCode ? (
          <button
            type="button"
            className="device-code"
            onClick={() => void actions.copyCode(status.userCode!)}
          >
            <span>Your one-time code</span>
            <strong>{status.userCode}</strong>
            <small>{actions.copied ? 'Copied' : 'Click to copy'}</small>
          </button>
        ) : null}
        {status.message || actions.error ? (
          <p className="inline-error" role="alert">
            {actions.error ?? status.message}
          </p>
        ) : null}

        <div className="auth-gate__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={actions.working || starting}
            onClick={() =>
              pending
                ? void actions.copyAndOpen(status)
                : void actions.connect()
            }
          >
            {pending ? 'Copy code and open ChatGPT' : 'Connect ChatGPT'}
          </button>
          {pending || starting ? (
            <button
              className="button button--quiet"
              type="button"
              disabled={actions.working}
              onClick={() => void actions.disconnect()}
            >
              Cancel
            </button>
          ) : null}
          <button
            className="text-button"
            type="button"
            disabled={actions.working}
            onClick={() => void actions.skip()}
          >
            Skip for now
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out of BeeGreat
          </button>
        </div>
      </section>
    </main>
  )
}

export function ChatGptSettings() {
  const status = useQuery(api.chatgptAuth.status)
  const actions = useChatGptActions()
  const [info, setInfo] = useState(false)
  if (!status)
    return <div className="settings-skeleton">Loading connection…</div>

  const pending = status.state === 'starting' || status.state === 'pending'
  const needsConnection = ['disconnected', 'failed', 'needs_reauth'].includes(
    status.state,
  )
  return (
    <div
      className={`connection-card${status.state === 'connected' ? ' is-active' : ''}`}
    >
      <div className="connection-card__heading">
        <span className="connection-mark" aria-hidden="true">
          ◎
        </span>
        <div>
          <strong>
            {status.state === 'connected'
              ? 'ChatGPT connected'
              : 'Connect ChatGPT'}
          </strong>
          <span>Codex model access</span>
        </div>
        <button
          className="info-toggle"
          type="button"
          aria-label="About the ChatGPT connection"
          aria-expanded={info}
          onClick={() => setInfo((value) => !value)}
        >
          i
        </button>
      </div>
      {info ? (
        <p className="settings-help">
          Bee can think with your ChatGPT plan through Codex. Without it,
          BeeGreat’s built-in model answers instead.
        </p>
      ) : null}
      {status.state === 'starting' ? (
        <p>Creating a secure device code…</p>
      ) : null}
      {status.state === 'pending' && status.userCode ? (
        <button
          type="button"
          className="device-code device-code--compact"
          onClick={() => void actions.copyCode(status.userCode!)}
        >
          <span>One-time code</span>
          <strong>{status.userCode}</strong>
          <small>{actions.copied ? 'Copied' : 'Click to copy'}</small>
        </button>
      ) : null}
      {status.message || actions.error ? (
        <p className="inline-error" role="alert">
          {actions.error ?? status.message}
        </p>
      ) : null}
      <div className="connection-card__actions">
        {needsConnection ? (
          <button
            className="button button--primary"
            type="button"
            disabled={actions.working}
            onClick={() => void actions.connect()}
          >
            Connect ChatGPT
          </button>
        ) : null}
        {status.state === 'pending' ? (
          <button
            className="button button--primary"
            type="button"
            disabled={actions.working}
            onClick={() => void actions.copyAndOpen(status)}
          >
            Copy code and open ChatGPT
          </button>
        ) : null}
        {pending || status.state === 'connected' ? (
          <button
            className={`button ${status.state === 'connected' ? 'button--danger' : 'button--quiet'}`}
            type="button"
            disabled={actions.working}
            onClick={() => void actions.disconnect()}
          >
            {pending ? 'Cancel' : 'Disconnect'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
