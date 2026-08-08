import { api } from '@beegreat/backend/convex/_generated/api'
import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { ChatGptSettings } from '../auth/chatgpt-auth'
import { setSpeakReplies, useSpeakReplies } from '../preferences/speak-replies'
import { setVoiceMode, useVoiceMode } from '../preferences/voice-mode'
import { useGoogleHealth } from './use-google-health'
import { BeennectorsSettings } from './beennectors-settings'
import { HotkeySettings } from './hotkey-settings'
import { TelegramSettings } from './telegram-settings'
import { WalletSettings } from './wallet-settings'
import { PublicProfileSettings } from './public-profile-settings'
import { useAccountDeletion } from './use-account-deletion'

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
  const voiceMode = useVoiceMode()
  const powerups = useQuery(api.powerups.list)
  const setPowerup = useMutation(api.powerups.setEnabled)
  const googleHealth = useGoogleHealth()
  const accountDeletion = useAccountDeletion()
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
      <header className="product-header settings-header">
        <div>
          <h1>Profile & settings</h1>
          <p>Shape how Bee works with you and what reaches your Hive.</p>
        </div>
      </header>

      <div className="settings-layout">
        <aside className="settings-profile-column">
          <section className="identity-card">
            <div className="identity-avatar">
              {user?.hasImage ? (
                <img src={user.imageUrl} alt="" />
              ) : (
                <span>{name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="identity-card__copy">
              <p className="utility-label">Your profile</p>
              <h2>{name}</h2>
              <p>{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <p className="identity-card__note">
              This is the identity Bee uses across your conversations and Hive.
            </p>
          </section>

          <div className="profile-sign-out">
            <p>
              Signed in on this device. Your Hive stays synced when you return.
            </p>
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
          </div>
        </aside>

        <div className="settings-content">
          <SettingsSection
            label="Public profile"
            className="settings-section--public-profile"
          >
            <PublicProfileSettings />
          </SettingsSection>

          <SettingsSection label="Bee Sites">
            <div className="bee-sites-setting-card">
              <div>
                <h3>Make a page with Bee</h3>
                <p>
                  Astro Creator builds static pages, gives you a private
                  preview, and publishes only when you say so.
                </p>
              </div>
              <Link to="/sites">
                Open site studio <span aria-hidden="true">→</span>
              </Link>
            </div>
          </SettingsSection>

          <SettingsSection label="Preferences">
            <SettingRow
              title="Voice mode"
              description={
                voiceMode === 'voice-note'
                  ? 'Transcribe, then send to Bee'
                  : 'Talk live with Grok Voice'
              }
              control={
                <div
                  className="voice-mode-control"
                  role="group"
                  aria-label="Voice mode"
                >
                  <button
                    type="button"
                    className={voiceMode === 'voice-note' ? 'is-selected' : ''}
                    aria-pressed={voiceMode === 'voice-note'}
                    onClick={() => setVoiceMode('voice-note')}
                  >
                    Voice note
                  </button>
                  <button
                    type="button"
                    className={
                      voiceMode === 'conversation' ? 'is-selected' : ''
                    }
                    aria-pressed={voiceMode === 'conversation'}
                    onClick={() => setVoiceMode('conversation')}
                  >
                    Live
                  </button>
                </div>
              }
            />
            <SettingRow
              title="Speak replies"
              description={
                speakReplies
                  ? 'Bee reads answers aloud'
                  : 'Replies stay on screen'
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

          <SettingsSection
            label="Keyboard shortcuts"
            className="settings-section--shortcuts"
          >
            <HotkeySettings />
          </SettingsSection>

          <SettingsSection
            label="Connections"
            className="settings-section--connections"
          >
            <ChatGptSettings />
            <TelegramSettings />
          </SettingsSection>

          <SettingsSection
            label="Beennectors"
            className="settings-section--beennectors"
          >
            <p className="beennector-intro">
              Bring your work into the Hive. These are secure connections—not
              Power-ups—and Bee only uses them when they help with your request.
            </p>
            <BeennectorsSettings />
          </SettingsSection>

          {powerups?.length ? (
            <SettingsSection
              label="Power-ups"
              className="settings-section--powerups"
            >
              {powerups.map((powerup) => {
                const health = powerup.id === 'google-health'
                const healthConnected =
                  googleHealth.status?.state === 'connected'
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
                        onChange={(next) =>
                          void togglePowerup(powerup.id, next)
                        }
                      />
                    </div>
                    {openInfo === powerup.id ? (
                      <p className="settings-help">{powerup.description}</p>
                    ) : null}
                    {health &&
                    powerup.enabled &&
                    googleHealth.status?.message ? (
                      <p className="inline-error">
                        {googleHealth.status.message}
                      </p>
                    ) : null}
                  </article>
                )
              })}
              {error ? (
                <p className="inline-error settings-grid-message" role="alert">
                  {error}
                </p>
              ) : null}
            </SettingsSection>
          ) : null}

          {powerups?.some(
            (powerup) => powerup.id === 'web3' && powerup.enabled,
          ) ? (
            <SettingsSection
              label="Wallets"
              className="settings-section--wallets"
            >
              <WalletSettings />
            </SettingsSection>
          ) : null}

          <SettingsSection
            label="Account"
            className="settings-section--account"
          >
            <div className="account-settings-card">
              <div className="account-settings-links">
                <a
                  href="https://apps.apple.com/account/subscriptions"
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage Apple subscription <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://beedocs.pages.dev/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms of Use <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://beedocs.pages.dev/privacy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy Policy <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://beedocs.pages.dev/support"
                  target="_blank"
                  rel="noreferrer"
                >
                  Support <span aria-hidden="true">↗</span>
                </a>
              </div>
              <div className="account-danger-zone">
                <div>
                  <strong>Delete your account</strong>
                  <p>Permanently remove your BeeGreat account and its data.</p>
                </div>
                <button
                  className="delete-account-button"
                  type="button"
                  disabled={accountDeletion.deleting}
                  onClick={() => void accountDeletion.requestDeletion()}
                >
                  {accountDeletion.deleting
                    ? 'Deleting account…'
                    : 'Delete account'}
                </button>
                {accountDeletion.error ? (
                  <p className="inline-error" role="alert">
                    {accountDeletion.error}
                  </p>
                ) : null}
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </main>
  )
}

function SettingsSection({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`settings-section${className ? ` ${className}` : ''}`}>
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
