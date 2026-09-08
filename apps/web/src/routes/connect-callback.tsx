import { api } from '@beegreat/backend/convex/_generated/api'
import { SignInButton, SignedIn, SignedOut, useUser } from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useRef, useState } from 'react'

import type {ConnectionCallback as Callback} from '~/features/settings/connection-callback';
import {  clearConnectionCallback, readConnectionCallback } from '~/features/settings/connection-callback'

export const Route = createFileRoute('/connect-callback')({ component: ConnectionCallback })

function ConnectionCallback() {
  const [callback, setCallback] = useState<Callback | null>(null)
  const read = useRef(false)
  useEffect(() => {
    if (read.current) return
    read.current = true
    try {
      setCallback(readConnectionCallback(window.location.hash, window.sessionStorage))
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // Keep the fragment when browser storage is unavailable so sign-in can return to it.
      const params = new URLSearchParams(window.location.hash.slice(1))
      const kind = params.get('kind')
      const state = params.get('state')
      if (state && (kind === 'beennector' || kind === 'google-health' || kind === 'telegram')) {
        setCallback({ kind, state, code: params.get('code') ?? undefined, errorCode: params.get('error') ?? undefined })
      }
    }
  }, [])
  return (
    <main className="gate-page">
      <section className="gate-card" aria-labelledby="connection-title">
        <h1 id="connection-title">Finish connecting</h1>
        {callback ? <>
          <SignedOut>
            <p>Sign in to the BeeGreat account that started this connection.</p>
            <SignInButton mode="modal" forceRedirectUrl="/connect-callback"><button className="gate-button" type="button">Sign in</button></SignInButton>
          </SignedOut>
          <SignedIn><CompleteConnection callback={callback} /></SignedIn>
        </> : <p>This connection link is missing or expired. Start again from Settings.</p>}
      </section>
    </main>
  )
}

function CompleteConnection({ callback }: { callback: Callback }) {
  const { user } = useUser()
  const beennector = useAction(api.beennectorAuthActions.completeAuthorization)
  const health = useAction(api.googleHealthAuthActions.completeAuthorization)
  const telegram = useAction(api.telegramAuthActions.completeAuthorization)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [completed, setCompleted] = useState<{ returnUrl?: string }>()
  const inFlight = useRef(false)

  async function finish() {
    if (inFlight.current) return
    inFlight.current = true
    setWorking(true)
    setError(undefined)
    try {
      const args = { state: callback.state, code: callback.code, errorCode: callback.errorCode }
      const result = callback.kind === 'beennector' ? await beennector(args)
        : callback.kind === 'google-health' ? await health(args) : await telegram(args)
      if (!result.ok) {
        setError('Connection did not complete. Use the BeeGreat account that started it, or start a new connection from Settings.')
        return
      }
      let returnUrl: string | undefined
      if (result.client === 'mobile') {
        const url = new URL('beegreat://profile')
        if (callback.kind === 'beennector' && 'provider' in result && typeof result.provider === 'string') {
          url.searchParams.set('beennector', result.provider)
          url.searchParams.set('status', 'connected')
        } else url.searchParams.set(callback.kind === 'google-health' ? 'googleHealth' : 'telegram', 'connected')
        returnUrl = url.toString()
      }
      try { clearConnectionCallback(window.sessionStorage) } catch { /* Connection already completed. */ }
      setCompleted({ returnUrl })
      if (!returnUrl) window.close()
    } catch {
      setError('Connection did not complete. Check your sign-in and try again.')
    } finally {
      inFlight.current = false
      setWorking(false)
    }
  }
  if (completed) return <>
    <p>Account connected.</p>
    {completed.returnUrl ? <a className="gate-button" href={completed.returnUrl}>Return to BeeGreat</a>
      : <Link className="gate-button" to="/settings">Return to Settings</Link>}
  </>
  return <>
    <p>{user?.primaryEmailAddress?.emailAddress}</p>
    <button type="button" className="gate-button" disabled={working} onClick={() => void finish()}>{working ? 'Connecting…' : 'Connect account'}</button>
    {error ? <p role="alert" className="inline-error">{error}</p> : null}
  </>
}
