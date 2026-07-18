import { api } from '@beegreat/backend/convex/_generated/api'
import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'

import { ChatGptSettings } from '../auth/chatgpt-auth'
import { setSpeakReplies, useSpeakReplies } from '../preferences/speak-replies'
import { useGoogleHealth } from './use-google-health'
import { BeennectorsSettings } from './beennectors-settings'

import type { ReactNode } from 'react'
import { captureWebFailure } from '~/lib/sentry'

const POWERUP_SYMBOLS: Record<string, string> = {
  devin: 'D',
  web3: '⌬',
  'google-health': '♥',
}

export function SettingsPage() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const speakReplies = useSpeakReplies()
  const powerups = useQuery(api.powerups.list)
  const setPowerup = useMutation(api.powerups.setEnabled)
  const googleHealth = useGoogleHealth()
  const [openInfo, setOpenInfo] = useState<string>()
  const [workingId, setWorkingId] = useState<string>()
  const [error, setError] = useState<string>()
  const [signingOut, setSigningOut] = useState(false)
  const name = user?.fullName ?? user?.username ?? 'Beekeeper'

  async function togglePowerup(id: string, enabled: boolean) {
    if (workingId) return
    let healthPopup: Window | undefined
    if (id === 'google-health' && enabled) {
      try {
        // Reserve the window during the click gesture; browsers block popups
        // opened after the asynchronous power-up mutation completes.
        healthPopup = googleHealth.reservePopup()
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Allow pop-ups to connect Google Health.',
        )
        return
      }
    }
    setWorkingId(id)
    setError(undefined)
    try {
      if (id !== 'google-health') {
        await setPowerup({ powerupId: id, enabled })
        return
      }
      if (!enabled) {
        await googleHealth.disconnect()
        await setPowerup({ powerupId: id, enabled: false })
        return
      }
      await setPowerup({ powerupId: id, enabled: true })
      try {
        const connected = await googleHealth.connect(healthPopup!)
        if (!connected) await setPowerup({ powerupId: id, enabled: false })
      } catch (cause) {
        await setPowerup({ powerupId: id, enabled: false })
        throw cause
      }
    } catch (cause) {
      captureWebFailure(cause, 'powerup.set_enabled', { powerupId: id })
      googleHealth.cancelPopup()
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update this power-up.',
      )
    } finally {
      setWorkingId(undefined)
    }
  }

  return (
    <main className="product-page settings-page">
      <header className="product-header">
        <div>
          <h1>Profile & settings</h1>
        </div>
      </header>

      <section className="identity-card">
        <div className="identity-avatar">
          {user?.hasImage ? (
            <img src={user.imageUrl} alt="" />
          ) : (
            <span>{name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h2>{name}</h2>
          <p>{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
      </section>

      <SettingsSection label="Preferences">
        <SettingRow
          title="Speak replies"
          description={
            speakReplies ? 'Bee reads answers aloud' : 'Replies stay on screen'
          }
          control={
            <Switch
              label="Speak replies aloud"
              checked={speakReplies}
              onChange={setSpeakReplies}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Connections">
        <ChatGptSettings />
      </SettingsSection>

      <SettingsSection label="Beennectors">
        <p className="beennector-intro">
          Bring your work into the Hive. These are secure connections—not
          Power-ups—and Bee only uses them when they help with your request.
        </p>
        <BeennectorsSettings />
      </SettingsSection>

      {powerups?.length ? (
        <SettingsSection label="Power-ups">
          {powerups.map((powerup) => {
            const health = powerup.id === 'google-health'
            const healthConnected = googleHealth.status?.state === 'connected'
            const enabled = health
              ? powerup.enabled && healthConnected
              : powerup.enabled
            return (
              <article className="powerup-card" key={powerup.id}>
                <div className="powerup-card__row">
                  <span className="powerup-mark" aria-hidden="true">
                    {POWERUP_SYMBOLS[powerup.id] ?? '⌁'}
                  </span>
                  <div>
                    <h3>{powerup.name}</h3>
                    <p>{powerup.tagline}</p>
                  </div>
                  <button
                    className="info-toggle"
                    type="button"
                    aria-label={`About the ${powerup.name} power-up`}
                    aria-expanded={openInfo === powerup.id}
                    onClick={() =>
                      setOpenInfo((current) =>
                        current === powerup.id ? undefined : powerup.id,
                      )
                    }
                  >
                    i
                  </button>
                  <Switch
                    label={`${powerup.name} power-up`}
                    checked={enabled}
                    disabled={workingId === powerup.id}
                    onChange={(next) => void togglePowerup(powerup.id, next)}
                  />
                </div>
                {openInfo === powerup.id ? (
                  <p className="settings-help">{powerup.description}</p>
                ) : null}
                {health && powerup.enabled && googleHealth.status?.message ? (
                  <p className="inline-error">{googleHealth.status.message}</p>
                ) : null}
              </article>
            )
          })}
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </SettingsSection>
      ) : null}

      <button
        className="sign-out-button"
        type="button"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true)
          void signOut().catch((cause) => {
            captureWebFailure(cause, 'auth.sign_out')
            setSigningOut(false)
            setError('Could not sign you out. Try again.')
          })
        }}
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </main>
  )
}

function SettingsSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className="settings-section">
      <p className="utility-label">{label}</p>
      <div>{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description: string
  control: ReactNode
}) {
  return (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {control}
    </div>
  )
}

function Switch({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      className={`switch${checked ? ' is-on' : ''}`}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}
