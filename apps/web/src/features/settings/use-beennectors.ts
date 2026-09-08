import { api } from '@beegreat/backend/convex/_generated/api'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { FunctionArgs } from 'convex/server'
import type { GoogleWorkspaceService } from '@beegreat/tool-presentation'

export type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'

const STATUS_SETTLE_MS = 1_500

export function useBeennectors() {
  const connections = useQuery(api.beennectors.list)
  const beginAuthorization = useAction(
    api.beennectorAuthActions.beginAuthorization,
  )
  const disconnectAction = useAction(api.beennectorAuthActions.disconnect)
  const cancelAuthorization = useMutation(api.beennectors.cancelAuthorization)
  const popupRef = useRef<Window | null>(null)
  const pendingSessionRef = useRef<Id<'beennectorAuthSessions'> | undefined>(undefined)
  const timerRef = useRef<number | undefined>(undefined)
  const connectionsRef = useRef(connections)
  connectionsRef.current = connections

  useEffect(
    () => () => {
      popupRef.current?.close()
      if (timerRef.current) window.clearInterval(timerRef.current)
      if (pendingSessionRef.current) {
        void cancelAuthorization({ sessionId: pendingSessionRef.current }).catch(() => undefined)
        pendingSessionRef.current = undefined
      }
    },
    [cancelAuthorization],
  )

  const connect = useCallback(
    async (
      provider: BeennectorProvider,
      google?: {
        services: Array<GoogleWorkspaceService>
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
      let sessionId: Id<'beennectorAuthSessions'>
      try {
        const request: FunctionArgs<
          typeof api.beennectorAuthActions.beginAuthorization
        > = { provider, client: 'browser' }
        if (provider === 'google' && google) {
          request.googleServices = google.services
          request.googleDisclosureVersion = google.disclosureVersion
        }
        ;({ authorizationUrl, sessionId } = await beginAuthorization(request))
      } catch (error) {
        popup.close()
        popupRef.current = null
        throw error
      }
      if (popup.closed) {
        await cancelAuthorization({ sessionId })
        return false
      }
      popup.location.assign(authorizationUrl)
      pendingSessionRef.current = sessionId

      if (timerRef.current) window.clearInterval(timerRef.current)
      return await new Promise<boolean>((resolve, reject) => {
        const startedAt = Date.now()
        const finish = (connected: boolean) => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          pendingSessionRef.current = undefined
          resolve(connected)
        }
        const cancel = () => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          pendingSessionRef.current = undefined
          void cancelAuthorization({ sessionId })
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
    [beginAuthorization, cancelAuthorization],
  )

  return {
    connections,
    connect,
    disconnect: (provider: BeennectorProvider) =>
      disconnectAction({ provider }),
  }
}
