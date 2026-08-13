import { api } from '@beegreat/backend/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { captureWebFailure } from '~/lib/sentry'

export function ImessageSettings() {
  const connections = useQuery(api.imessage.connections)
  const disconnect = useMutation(api.imessage.disconnect)
  const [workingAddress, setWorkingAddress] = useState<string>()
  const [error, setError] = useState<string>()

  async function removeConnection(address: string) {
    if (workingAddress) return
    setWorkingAddress(address)
    setError(undefined)
    try {
      await disconnect({ address })
    } catch (cause) {
      captureWebFailure(cause, 'imessage.disconnect')
      setError('Could not disconnect this address. Try again.')
    } finally {
      setWorkingAddress(undefined)
    }
  }

  if (!connections) {
    return <div className="settings-skeleton">Loading iMessage…</div>
  }
  const connected = connections.length > 0

  return (
    <article className={`connection-card${connected ? ' is-active' : ''}`}>
      <div className="connection-card__heading">
        <span className="connection-mark connection-mark--imessage" aria-hidden="true">
          ✉
        </span>
        <div>
          <h3>{connected ? 'iMessage connected' : 'Connect iMessage'}</h3>
          <span>
            {connected
              ? 'Bee answers these senders in Messages.'
              : "Text Bee from Messages and open the link she replies with — that's the whole setup."}
          </span>
        </div>
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {connected ? (
        <ul className="imessage-address-list">
          {connections.map((connection) => (
            <li key={connection.address}>
              <span>{connection.address}</span>
              <button
                className="button button--quiet"
                type="button"
                disabled={workingAddress === connection.address}
                onClick={() => void removeConnection(connection.address)}
              >
                {workingAddress === connection.address
                  ? 'Working…'
                  : 'Disconnect'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
