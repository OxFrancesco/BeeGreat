import { api } from '@beegreat/backend/convex/_generated/api'
import {
  SignInButton,
  SignedIn,
  SignedOut,
} from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { useEffect, useState } from 'react'

import beeUrl from '../../../mobile/assets/images/bee.webp?url'
import { captureWebFailure } from '~/lib/sentry'

type LinkPreview = {
  maskedAddress: string
  addressKind: 'phone' | 'email'
  status: string
  expiresAt: number
}

export const Route = createFileRoute('/link/imessage')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: LinkImessagePage,
})

function LinkImessagePage() {
  const { token } = Route.useSearch()
  const previewLink = useAction(api.imessageAuth.previewLink)
  const completeLink = useAction(api.imessageAuth.completeLink)
  const [preview, setPreview] = useState<LinkPreview | null>()
  const [result, setResult] = useState<{
    status: 'linked' | 'invalid' | 'expired'
    maskedAddress?: string
  }>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!token) {
      setPreview(null)
      return
    }
    let cancelled = false
    previewLink({ token })
      .then((session) => {
        if (!cancelled) setPreview(session)
      })
      .catch((cause) => {
        captureWebFailure(cause, 'imessage.link_preview')
        if (!cancelled) setPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [token, previewLink])

  async function link() {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      setResult(await completeLink({ token }))
    } catch (cause) {
      captureWebFailure(cause, 'imessage.link_complete')
      setError('Could not link this address. Try again.')
    } finally {
      setWorking(false)
    }
  }

  const kindLabel = preview?.addressKind === 'email' ? 'address' : 'number'
  const usable =
    Boolean(token) &&
    preview?.status === 'pending' &&
    preview.expiresAt > Date.now()

  return (
    <main className="gate-page">
      <section className="gate-card" aria-labelledby="gate-title">
        <img src={beeUrl} alt="" className="gate-bee" />
        <h1 id="gate-title">Connect iMessage</h1>

        {preview === undefined ? (
          <p>Checking your link…</p>
        ) : result?.status === 'linked' ? (
          <>
            <p>
              {result.maskedAddress ?? 'Your address'} is now linked to your
              BeeGreat account. Head back to Messages and text Bee — she's
              ready.
            </p>
            <Link className="gate-button" to="/bee">
              Open BeeGreat
            </Link>
          </>
        ) : result?.status === 'expired' || preview === null || !usable ? (
          <p>
            This link {result?.status === 'expired' ? 'expired' : 'is no longer valid'}. Text Bee
            again from Messages to get a fresh one — links stay valid for 15
            minutes.
          </p>
        ) : (
          <>
            <p>
              Bee received a message from{' '}
              <strong>{preview.maskedAddress}</strong>. Link this {kindLabel}{' '}
              to your BeeGreat account so Bee can answer you in Messages.
            </p>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="gate-button">
                  Sign in or create your account
                </button>
              </SignInButton>
              <p className="gate-note">
                After signing in you'll confirm the link on this page.
              </p>
            </SignedOut>
            <SignedIn>
              <button
                type="button"
                className="gate-button"
                disabled={working}
                onClick={() => void link()}
              >
                {working ? 'Linking…' : `Link this ${kindLabel}`}
              </button>
              <p className="gate-note">
                You can disconnect it anytime from Settings → Connections or by
                texting /unlink to Bee.
              </p>
            </SignedIn>
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  )
}
