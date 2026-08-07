import { api } from '@beegreat/backend/convex/_generated/api'
import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'

export type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'

const STATUS_SETTLE_MS = 1_500

export function useBeennectors() {
  const connections = useQuery(api.beennectors.list)
  const beginAuthorization = useAction(
    api.beennectorAuthActions.beginAuthorization,
  )
  const disconnectAction = useAction(api.beennectorAuthActions.disconnect)
  const popupRef = useRef<Window | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  useEffect(
    () => () => {
      popupRef.current?.close()
      if (timerRef.current) window.clearInterval(timerRef.current)
    },
    [],
  )

  const connect = useCallback(
    async (provider: BeennectorProvider) => {
      const popup = window.open(
        'about:blank',
        `beegreat-beennector-${provider}`,
        'popup,width=620,height=780',
      )
      if (!popup) throw new Error(`Allow pop-ups to connect ${provider}.`)
      popup.opener = null
      popupRef.current = popup
      let authorizationUrl: string
      try {
        ;({ authorizationUrl } = await beginAuthorization({ provider }))
      } catch (error) {
        popup.close()
        popupRef.current = null
        throw error
      }
      if (popup.closed) return false
      popup.location.assign(authorizationUrl)

      if (timerRef.current) window.clearInterval(timerRef.current)
      return await new Promise<boolean>((resolve, reject) => {
        const startedAt = Date.now()
        const finish = (connected: boolean) => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          resolve(connected)
        }
        timerRef.current = window.setInterval(() => {
          const connection = connectionsRef.current?.find(
            (candidate) => candidate.provider === provider,
          )
          if (connection?.state === 'connected') {
            popup.close()
            finish(true)
            return
          }
          if (
            connection?.state === 'failed' &&
            Date.now() - startedAt >= STATUS_SETTLE_MS
          ) {
            popup.close()
            if (timerRef.current) window.clearInterval(timerRef.current)
            timerRef.current = undefined
            popupRef.current = null
            reject(new Error(connection.message))
            return
          }
          if (popup.closed || Date.now() - startedAt > 10 * 60 * 1_000) {
            popup.close()
            finish(false)
          }
        }, 500)
      })
    },
    [beginAuthorization],
  )

  return {
    connections,
    connect,
    disconnect: (provider: BeennectorProvider) =>
      disconnectAction({ provider }),
  }
}
