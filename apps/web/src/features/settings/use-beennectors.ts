import { api } from '@beegreat/backend/convex/_generated/api'
import { useAction, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'
import type { GoogleWorkspaceService } from '@beegreat/tool-presentation'

export type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'

const STATUS_SETTLE_MS = 1_500

export function useBeennectors() {
  const connections = useQuery(api.beennectors.list)
  const beginAuthorization = useAction(
    api.beennectorAuthActions.beginAuthorization,
  )
  const disconnectAction = useAction(api.beennectorAuthActions.disconnect)
  const popupRef = useRef<Window | null>(null)
  const pendingProviderRef = useRef<BeennectorProvider | undefined>(undefined)
  const timerRef = useRef<number | undefined>(undefined)
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  useEffect(
    () => () => {
      popupRef.current?.close()
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (pendingProviderRef.current) {
        void disconnectAction({ provider: pendingProviderRef.current })
        pendingProviderRef.current = undefined
      }
    },
    [disconnectAction],
  )

  const connect = useCallback(
    async (
      provider: BeennectorProvider,
      google?: {
        services: GoogleWorkspaceService[]
        disclosureVersion: string
      },
    ) => {
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
        ;({ authorizationUrl } = await beginAuthorization({
          provider,
          ...(provider === 'google' && google
            ? {
                googleServices: google.services,
                googleDisclosureVersion: google.disclosureVersion,
              }
            : {}),
        }))
      } catch (error) {
        popup.close()
        popupRef.current = null
        throw error
      }
      if (popup.closed) return false
      popup.location.assign(authorizationUrl)
      pendingProviderRef.current = provider

      if (timerRef.current) window.clearInterval(timerRef.current)
      return await new Promise<boolean>((resolve, reject) => {
        const startedAt = Date.now()
        const finish = (connected: boolean) => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          pendingProviderRef.current = undefined
          resolve(connected)
        }
        const cancel = () => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          pendingProviderRef.current = undefined
          void disconnectAction({ provider })
            .catch(() => undefined)
            .finally(() => resolve(false))
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
            cancel()
          }
        }, 500)
      })
    },
    [beginAuthorization, disconnectAction],
  )

  return {
    connections,
    connect,
    disconnect: (provider: BeennectorProvider) =>
      disconnectAction({ provider }),
  }
}
