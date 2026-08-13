import { api } from '@beegreat/backend/convex/_generated/api'
import {
  SignInButton,
  SignedIn,
  SignedOut,
} from '@clerk/tanstack-react-start'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import {
  GOOGLE_WORKSPACE_DISCLOSURE,
  GOOGLE_WORKSPACE_DISCLOSURE_VERSION,
  GOOGLE_WORKSPACE_SERVICES,
  type GoogleWorkspaceService,
} from '@beegreat/tool-presentation'

import beeUrl from '../../../mobile/assets/images/bee.webp?url'
import { ChatGptSettings } from '~/features/auth/chatgpt-auth'
import { captureWebFailure } from '~/lib/sentry'

type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google'

// Every connector Bee can hand out as a link on text channels (iMessage,
// CLI). OAuth providers redirect this tab; the rest render their own flow.
type Connector = {
  name: string
  description: string
  kind: 'beennector' | 'telegram' | 'google-health' | 'chatgpt' | 'powerup'
}

const CONNECTORS: Record<string, Connector | undefined> = {
  github: {
    name: 'GitHub',
    description: 'Let Bee read your issues and pull requests.',
    kind: 'beennector',
  },
  linear: {
    name: 'Linear',
    description: 'Let Bee read your assigned issues and comments.',
    kind: 'beennector',
  },
  notion: {
    name: 'Notion',
    description: 'Let Bee read pages you explicitly share.',
    kind: 'beennector',
  },
  google: {
    name: 'Google Workspace',
    description: 'Choose the Google Workspace services Bee may use for your requests.',
    kind: 'beennector',
  },
  telegram: {
    name: 'Telegram',
    description: 'Let Bee send notes and updates straight to you.',
    kind: 'telegram',
  },
  'google-health': {
    name: 'Google Health',
    description: 'Give Bee read-only access to your health data.',
    kind: 'google-health',
  },
  chatgpt: {
    name: 'ChatGPT',
    description: 'Run Bee on your ChatGPT subscription.',
    kind: 'chatgpt',
  },
  devin: {
    name: 'Devin',
    description: 'Send coding tasks to Devin in the cloud.',
    kind: 'powerup',
  },
  web3: {
    name: 'Web3',
    description: 'Give Bee a smart wallet for onchain actions.',
    kind: 'powerup',
  },
}

export const Route = createFileRoute('/connect/$provider')({
  component: ConnectPage,
})

function ConnectPage() {
  const { provider } = Route.useParams()
  const connector = CONNECTORS[provider]

  return (
    <main className="gate-page">
      <section className="gate-card" aria-labelledby="gate-title">
        <img src={beeUrl} alt="" className="gate-bee" />
        {!connector ? (
          <>
            <h1 id="gate-title">Unknown connection</h1>
            <p>
              Bee doesn't know this connection. Check the link or open
              Settings → Connections in BeeGreat.
            </p>
          </>
        ) : (
          <>
            <h1 id="gate-title">Connect {connector.name}</h1>
            <p>{connector.description}</p>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="gate-button">
                  Sign in to continue
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <ConnectFlow provider={provider} kind={connector.kind} name={connector.name} />
            </SignedIn>
          </>
        )}
      </section>
    </main>
  )
}

function ConnectFlow({
  provider,
  kind,
  name,
}: {
  provider: string
  kind: 'beennector' | 'telegram' | 'google-health' | 'chatgpt' | 'powerup'
  name: string
}) {
  if (kind === 'chatgpt') return <ChatGptSettings />
  if (kind === 'powerup') return <PowerupFlow provider={provider} name={name} />
  return <OauthFlow provider={provider} kind={kind} name={name} />
}

function PowerupFlow({ provider, name }: { provider: string; name: string }) {
  const powerups = useQuery(api.powerups.list)
  const setPowerup = useMutation(api.powerups.setEnabled)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const powerup = powerups?.find((candidate) => candidate.id === provider)

  async function toggle(enabled: boolean) {
    if (working) return
    setWorking(true)
    setError(undefined)
    try {
      await setPowerup({ powerupId: provider, enabled })
    } catch (cause) {
      captureWebFailure(cause, 'connect.powerup', { provider })
      setError(
        cause instanceof Error ? cause.message : 'Could not update this power-up.',
      )
    } finally {
      setWorking(false)
    }
  }

  if (!powerups) return <p>Loading…</p>
  if (!powerup) {
    return <p>This power-up isn't available on your account yet.</p>
  }
  return (
    <>
      {powerup.enabled ? (
        <>
          <p>
            {name} is on. Ask Bee for it from any device — including right back
            in Messages.
          </p>
          <button
            type="button"
            className="gate-button gate-button--quiet"
            disabled={working}
            onClick={() => void toggle(false)}
          >
            {working ? 'Working…' : `Turn off ${name}`}
          </button>
        </>
      ) : (
        <button
          type="button"
          className="gate-button"
          disabled={working}
          onClick={() => void toggle(true)}
        >
          {working ? 'Working…' : `Turn on ${name}`}
        </button>
      )}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="gate-note">
        Manage power-ups anytime from <Link to="/settings">Settings</Link>.
      </p>
    </>
  )
}

function OauthFlow({
  provider,
  kind,
  name,
}: {
  provider: string
  kind: 'beennector' | 'telegram' | 'google-health'
  name: string
}) {
  const beennectors = useQuery(
    api.beennectors.list,
    kind === 'beennector' ? {} : 'skip',
  )
  const telegramStatus = useQuery(
    api.telegram.status,
    kind === 'telegram' ? {} : 'skip',
  )
  const googleHealthStatus = useQuery(
    api.googleHealthAuth.status,
    kind === 'google-health' ? {} : 'skip',
  )
  const beginBeennector = useAction(api.beennectorAuthActions.beginAuthorization)
  const beginTelegram = useAction(api.telegramAuthActions.beginAuthorization)
  const beginGoogleHealth = useAction(
    api.googleHealthAuthActions.beginAuthorization,
  )
  const setPowerup = useMutation(api.powerups.setEnabled)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [googleDisclosureOpen, setGoogleDisclosureOpen] = useState(false)
  const [googleServices, setGoogleServices] = useState<GoogleWorkspaceService[]>([])

  const connected =
    kind === 'beennector'
      ? beennectors?.find((candidate) => candidate.provider === provider)
          ?.state === 'connected'
      : kind === 'telegram'
        ? telegramStatus?.state === 'connected'
        : googleHealthStatus?.state === 'connected'

  async function connect() {
    if (working) return
    if (kind === 'beennector' && provider === 'google' && !googleDisclosureOpen) {
      setGoogleDisclosureOpen(true)
      return
    }
    setWorking(true)
    setError(undefined)
    try {
      let authorizationUrl: string
      if (kind === 'beennector') {
        ;({ authorizationUrl } = await beginBeennector({
          provider: provider as BeennectorProvider,
          ...(provider === 'google'
            ? {
                googleServices,
                googleDisclosureVersion: GOOGLE_WORKSPACE_DISCLOSURE_VERSION,
              }
            : {}),
        }))
      } else if (kind === 'telegram') {
        ;({ authorizationUrl } = await beginTelegram({ client: 'browser' }))
      } else {
        // Google Health is gated by its power-up; connecting from a link
        // implies turning it on, matching the settings-screen behavior.
        await setPowerup({ powerupId: 'google-health', enabled: true })
        ;({ authorizationUrl } = await beginGoogleHealth({}))
      }
      window.location.assign(authorizationUrl)
    } catch (cause) {
      captureWebFailure(cause, 'connect.oauth', { provider })
      setWorking(false)
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not connect ${name}. Try again.`,
      )
    }
  }

  if (connected) {
    return (
      <>
        <p>{name} is already connected. Bee can use it right away.</p>
        <p className="gate-note">
          Manage or disconnect it anytime from{' '}
          <Link to="/settings">Settings</Link>.
        </p>
      </>
    )
  }
  return (
    <>
      {provider === 'google' && googleDisclosureOpen ? (
        <div className="google-workspace-disclosure gate-disclosure">
          <strong>Choose what BeeGreat may access</strong>
          <div className="google-workspace-services">
            {GOOGLE_WORKSPACE_SERVICES.map((service) => {
              const selected = googleServices.includes(service.id)
              return (
                <label className="google-workspace-service" key={service.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      setGoogleServices((current) =>
                        selected
                          ? current.filter((item) => item !== service.id)
                          : [...current, service.id],
                      )
                    }
                  />
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.access}</small>
                  </span>
                </label>
              )
            })}
          </div>
          <p>{GOOGLE_WORKSPACE_DISCLOSURE}</p>
          <p>
            By continuing, you consent to this access and processing. See
            BeeGreat’s Privacy Policy for full details.
          </p>
        </div>
      ) : null}
      <button
        type="button"
        className="gate-button"
        disabled={
          working ||
          (provider === 'google' && googleDisclosureOpen && googleServices.length === 0)
        }
        onClick={() => void connect()}
      >
        {working
          ? 'Opening…'
          : provider === 'google' && googleDisclosureOpen
            ? googleServices.length
              ? 'I understand — continue to Google'
              : 'Choose at least one service'
            : `Continue with ${name}`}
      </button>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="gate-note">
        You'll approve access on {name}'s own page, then land back here.
      </p>
    </>
  )
}
