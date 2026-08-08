import { api } from '@beegreat/backend/convex/_generated/api'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'

import { captureWebFailure } from '~/lib/sentry'

export function TelegramSettings() {
  const status = useQuery(api.telegram.status)
  const beginAuthorization = useAction(
    api.telegramAuthActions.beginAuthorization,
  )
  const disconnect = useMutation(api.telegram.disconnect)
  const popupRef = useRef<Window | null>(null)
  const popupTimerRef = useRef<number | undefined>(undefined)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (status?.state === 'connected') {
      popupRef.current?.close()
      popupRef.current = null
      if (popupTimerRef.current) window.clearInterval(popupTimerRef.current)
      popupTimerRef.current = undefined
      setWorking(false)
    }
  }, [status?.state])

  useEffect(
    () => () => {
      popupRef.current?.close()
      if (popupTimerRef.current) window.clearInterval(popupTimerRef.current)
    },
    [],
  )

  async function connect() {
    if (working) return
    const popup = window.open(
      'about:blank',
      'beegreat-telegram',
      'popup,width=560,height=760',
    )
    if (!popup) {
      setError('Allow pop-ups to connect Telegram.')
      return
    }
    popup.opener = null
    popupRef.current = popup
    popupTimerRef.current = window.setInterval(() => {
      if (!popup.closed) return
      window.clearInterval(popupTimerRef.current)
      popupTimerRef.current = undefined
      popupRef.current = null
      setWorking(false)
    }, 500)
    setWorking(true)
    setError(undefined)
    try {
      const { authorizationUrl } = await beginAuthorization({ client: 'browser' })
      if (popup.closed) return
      popup.location.assign(authorizationUrl)
    } catch (cause) {
      popup.close()
      popupRef.current = null
      if (popupTimerRef.current) window.clearInterval(popupTimerRef.current)
      popupTimerRef.current = undefined
      setWorking(false)
      captureWebFailure(cause, 'telegram.connect')
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not connect Telegram. Try again.',
      )
    }
  }

  async function removeConnection() {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      await disconnect({})
    } catch (cause) {
      captureWebFailure(cause, 'telegram.disconnect')
      setError('Could not disconnect Telegram. Try again.')
    } finally {
      setWorking(false)
    }
  }

  if (!status) return <div className="settings-skeleton">Loading Telegram…</div>
  const connected = status.state === 'connected'
  const account =
    status.state === 'connected'
      ? status.username
        ? `@${status.username}`
        : status.displayName
      : undefined

  return (
    <article className={`connection-card${connected ? ' is-active' : ''}`}>
      <div className="connection-card__heading">
        <span className="connection-mark connection-mark--telegram" aria-hidden="true">
          ↗
        </span>
        <div>
          <h3>{connected ? 'Telegram connected' : 'Connect Telegram'}</h3>
          <span>
            {connected
              ? `${account ?? 'Your account'} can receive messages from Bee.`
              : 'Let Bee send notes and updates directly to you.'}
          </span>
        </div>
      </div>
      {status.message || error ? (
        <p className="inline-error" role="alert">
          {error ?? status.message}
        </p>
      ) : null}
      <div className="connection-card__actions">
        <button
          className={connected ? 'button button--quiet' : 'button button--primary'}
          type="button"
          disabled={working}
          onClick={() => void (connected ? removeConnection() : connect())}
        >
          {working
            ? 'Working…'
            : connected
              ? 'Disconnect'
              : 'Continue with Telegram'}
        </button>
      </div>
    </article>
  )
}
