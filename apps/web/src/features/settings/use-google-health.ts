import { api } from '@beegreat/backend/convex/_generated/api'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef } from 'react'

const STATUS_SETTLE_MS = 1_500

export function useGoogleHealth() {
  const status = useQuery(api.googleHealthAuth.status)
  const beginAuthorization = useAction(
    api.googleHealthAuthActions.beginAuthorization,
  )
  const disconnectMutation = useMutation(api.googleHealthAuth.disconnect)
  const popupRef = useRef<Window | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const settleRef = useRef<((connected: boolean) => void) | undefined>(
    undefined,
  )
  const statusRef = useRef(status)
  statusRef.current = status

  useEffect(
    () => () => {
      popupRef.current?.close()
      if (settleRef.current) settleRef.current(false)
      else if (timerRef.current) window.clearInterval(timerRef.current)
    },
    [],
  )

  const reservePopup = useCallback(() => {
    const popup = window.open(
      'about:blank',
      'beegreat-google-health',
      'popup,width=560,height=760',
    )
    if (!popup) {
      throw new Error('Allow pop-ups to connect Google Health.')
    }
    popup.opener = null
    popupRef.current = popup
    return popup
  }, [])

  const cancelPopup = useCallback(() => {
    popupRef.current?.close()
    if (settleRef.current) settleRef.current(false)
    else {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = undefined
      popupRef.current = null
    }
  }, [])

  const connect = useCallback(
    async (reservedPopup: Window) => {
      let authorizationUrl: string
      try {
        ;({ authorizationUrl } = await beginAuthorization({}))
      } catch (cause) {
        reservedPopup.close()
        popupRef.current = null
        throw cause
      }
      if (reservedPopup.closed) return false
      reservedPopup.location.assign(authorizationUrl)

      if (timerRef.current) window.clearInterval(timerRef.current)
      return await new Promise<boolean>((resolve, reject) => {
        const finish = (connected: boolean) => {
          if (timerRef.current) window.clearInterval(timerRef.current)
          timerRef.current = undefined
          popupRef.current = null
          settleRef.current = undefined
          resolve(connected)
        }
        settleRef.current = finish
        const startedAt = Date.now()
        timerRef.current = window.setInterval(() => {
          if (statusRef.current?.state === 'connected') {
            reservedPopup.close()
            finish(true)
            return
          }
          if (
            statusRef.current?.state === 'failed' &&
            Date.now() - startedAt >= STATUS_SETTLE_MS
          ) {
            reservedPopup.close()
            if (timerRef.current) window.clearInterval(timerRef.current)
            timerRef.current = undefined
            popupRef.current = null
            settleRef.current = undefined
            reject(new Error(statusRef.current.message))
            return
          }
          if (reservedPopup.closed || Date.now() - startedAt > 10 * 60 * 1000) {
            reservedPopup.close()
            finish(false)
          }
        }, 500)
      })
    },
    [beginAuthorization],
  )

  return {
    status,
    reservePopup,
    cancelPopup,
    connect,
    disconnect: () => disconnectMutation({}),
  }
}
