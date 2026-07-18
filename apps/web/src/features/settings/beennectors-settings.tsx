import { useState } from 'react'
import { captureWebFailure } from '~/lib/sentry'
import {
  type BeennectorProvider,
  useBeennectors,
} from './use-beennectors'

const MARKS: Record<BeennectorProvider, string> = {
  github: '⌘',
  linear: '◩',
  notion: 'N',
}

export function BeennectorsSettings() {
  const beennectors = useBeennectors()
  const [working, setWorking] = useState<BeennectorProvider>()
  const [info, setInfo] = useState<BeennectorProvider>()
  const [error, setError] = useState<string>()

  if (!beennectors.connections) {
    return <div className="settings-skeleton">Loading Beennectors…</div>
  }

  async function toggle(provider: BeennectorProvider, connected: boolean) {
    if (working) return
    setWorking(provider)
    setError(undefined)
    try {
      if (connected) await beennectors.disconnect(provider)
      else await beennectors.connect(provider)
    } catch (cause) {
      captureWebFailure(cause, 'beennector.connection', { provider })
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not update the ${provider} Beennector.`,
      )
    } finally {
      setWorking(undefined)
    }
  }

  return (
    <>
      {beennectors.connections.map((connection) => {
        const connected = connection.state === 'connected'
        const pending = connection.state === 'pending'
        const detail =
          connection.workspaceName ??
          connection.accountName ??
          connection.description
        return (
          <article
            className={`connection-card beennector-card${connected ? ' is-active' : ''}`}
            key={connection.provider}
          >
            <div className="connection-card__heading">
              <span
                className={`connection-mark connection-mark--${connection.provider}`}
                aria-hidden="true"
              >
                {MARKS[connection.provider]}
              </span>
              <div>
                <strong>
                  {connected
                    ? `${connection.name} connected`
                    : `Connect ${connection.name}`}
                </strong>
                <span>{detail}</span>
              </div>
              <span
                className={`beennector-status beennector-status--${connection.state}`}
              >
                {connected ? 'Linked' : pending ? 'Waiting' : 'Off'}
              </span>
              <button
                className="info-toggle"
                type="button"
                aria-label={`About the ${connection.name} Beennector`}
                aria-expanded={info === connection.provider}
                onClick={() =>
                  setInfo((current) =>
                    current === connection.provider
                      ? undefined
                      : connection.provider,
                  )
                }
              >
                i
              </button>
            </div>
            {info === connection.provider ? (
              <p className="settings-help">
                {connection.description} Credentials are encrypted and Bee only
                receives the results of approved Beennector operations.
              </p>
            ) : null}
            {connection.message ? (
              <p className="inline-error" role="alert">
                {connection.message}
              </p>
            ) : null}
            <div className="connection-card__actions">
              <button
                className={`button ${connected ? 'button--danger' : 'button--primary'}`}
                type="button"
                disabled={Boolean(working) || pending}
                onClick={() =>
                  void toggle(connection.provider, connected)
                }
              >
                {working === connection.provider
                  ? connected
                    ? 'Disconnecting…'
                    : 'Connecting…'
                  : connected
                    ? `Disconnect ${connection.name}`
                    : pending
                      ? `Waiting for ${connection.name}…`
                      : `Connect ${connection.name}`}
              </button>
            </div>
          </article>
        )
      })}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  )
}

