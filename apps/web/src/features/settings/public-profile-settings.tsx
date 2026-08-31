import { api } from '@beegreat/backend/convex/_generated/api'
import { useUser } from '@clerk/tanstack-react-start'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import type { FunctionArgs } from 'convex/server'

import { captureWebFailure } from '~/lib/sentry'
import { HoneyQrCode } from '~/components/honey-qr-code'

const PROVIDERS = [
  'instagram',
  'linkedin',
  'x',
  'github',
  'youtube',
  'tiktok',
  'facebook',
  'website',
  'other',
] as const
type Provider = (typeof PROVIDERS)[number]
type EditableLink = {
  id: string
  provider: Provider
  label: string
  url: string
}

function providerLabel(provider: Provider) {
  return provider === 'x'
    ? 'X'
    : provider.slice(0, 1).toUpperCase() + provider.slice(1)
}

function newLink(): EditableLink {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    provider: 'website',
    label: '',
    url: '',
  }
}

export function PublicProfileSettings() {
  const { user } = useUser()
  const profile = useQuery(api.publicProfiles.mine)
  const ensureProfile = useMutation(api.publicProfiles.ensureMine)
  const saveProfile = useMutation(api.publicProfiles.saveMine)
  const ensuring = useRef(false)
  const initialized = useRef(false)
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [published, setPublished] = useState(false)
  const [links, setLinks] = useState<Array<EditableLink>>([])
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (profile !== null || ensuring.current || !user) return
    ensuring.current = true
    const seed: FunctionArgs<typeof api.publicProfiles.ensureMine> = {
      displayName: user.fullName ?? user.username ?? 'Beekeeper',
      suggestedHandle: user.username ?? user.fullName ?? 'beekeeper',
    }
    if (user.hasImage) seed.avatarUrl = user.imageUrl
    void ensureProfile(seed).catch((cause) => {
      captureWebFailure(cause, 'public_profile.ensure')
      setError('Could not prepare your public profile. Try again.')
      ensuring.current = false
    })
  }, [ensureProfile, profile, user])

  useEffect(() => {
    if (!profile || initialized.current) return
    initialized.current = true
    setDisplayName(profile.displayName)
    setHandle(profile.handle)
    setBio(profile.bio ?? '')
    setPublished(profile.published)
    setLinks(
      profile.links.map((link, index) => ({
        id: `${index}-${link.url}`,
        ...link,
      })),
    )
  }, [profile])

  function updateLink(id: string, update: Partial<EditableLink>) {
    setLinks((current) =>
      current.map((link) => (link.id === id ? { ...link, ...update } : link)),
    )
  }

  function moveLink(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= links.length) return
    setLinks((current) => {
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  async function save() {
    if (!profile || saving) return
    const incomplete = links.find(
      (link) => Boolean(link.label.trim()) !== Boolean(link.url.trim()),
    )
    if (incomplete) {
      setError('Each link needs both a label and an HTTPS URL.')
      return
    }
    setSaving(true)
    setError(undefined)
    setMessage(undefined)
    try {
      const draft: FunctionArgs<typeof api.publicProfiles.saveMine> = {
        handle,
        displayName,
        published,
        links: links
          .filter((link) => link.label.trim() && link.url.trim())
          .map(({ provider, label, url }) => ({ provider, label, url })),
      }
      if (bio.trim()) draft.bio = bio
      if (profile.avatarUrl) draft.avatarUrl = profile.avatarUrl
      const saved = await saveProfile(draft)
      setHandle(saved.handle)
      setDisplayName(saved.displayName)
      setBio(saved.bio ?? '')
      setPublished(saved.published)
      setLinks(
        saved.links.map((link, index) => ({
          id: `${index}-${link.url}`,
          ...link,
        })),
      )
      setMessage(
        saved.published ? 'Profile saved and published.' : 'Draft saved.',
      )
    } catch (cause) {
      captureWebFailure(cause, 'public_profile.save')
      setError(
        cause instanceof Error ? cause.message : 'Could not save your profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!profile) return
    await navigator.clipboard.writeText(profile.profileUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
  }

  async function shareProfile() {
    if (!profile) return
    if (Reflect.has(navigator, 'share')) {
      await navigator.share({
        title: `${displayName} on BeeGreat`,
        text: 'Find me on BeeGreat',
        url: profile.profileUrl,
      })
      return
    }
    await copyLink()
  }

  if (!profile) {
    return (
      <div className="public-profile-loading">
        <span className="spinner" aria-hidden="true" />
        <p>Preparing your permanent profile link…</p>
      </div>
    )
  }

  return (
    <div className="public-profile-editor">
      <div className="public-profile-share-card">
        <div className="public-profile-qr-wrap">
          <HoneyQrCode
            value={profile.qrUrl}
            label="Permanent public profile QR code"
            className="public-profile-qr"
          />
        </div>
        <div className="public-profile-share-copy">
          <span className={`profile-status${published ? ' is-published' : ''}`}>
            {published ? 'Published' : 'Private draft'}
          </span>
          <h3>Your permanent QR</h3>
          <p>bee.buddytools.org/@{handle || profile.handle}</p>
          <div className="public-profile-share-actions">
            <button type="button" onClick={() => void shareProfile()}>
              Share profile
            </button>
            <button
              type="button"
              className="quiet"
              onClick={() => void copyLink()}
            >
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>

      <div className="public-profile-form-grid">
        <label>
          <span>Display name</span>
          <input
            value={displayName}
            maxLength={60}
            autoComplete="name"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          <span>Handle</span>
          <div className="public-profile-handle-input">
            <span>@</span>
            <input
              value={handle}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => setHandle(event.target.value)}
            />
          </div>
        </label>
        <label className="public-profile-bio-field">
          <span>
            Bio <small>{bio.length}/180</small>
          </span>
          <textarea
            value={bio}
            maxLength={180}
            rows={4}
            placeholder="What should people know about you?"
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
      </div>

      <div className="public-profile-links-heading">
        <div>
          <h3>Socials & links</h3>
          <p>
            Add up to 12 HTTPS links, then arrange them in the order people see.
          </p>
        </div>
        <button
          type="button"
          className="quiet"
          disabled={links.length >= 12}
          onClick={() => setLinks((current) => [...current, newLink()])}
        >
          + Add link
        </button>
      </div>

      <div className="public-profile-links-editor">
        {links.map((link, index) => (
          <article className="public-profile-link-editor" key={link.id}>
            <select
              aria-label={`Link ${index + 1} provider`}
              value={link.provider}
              onChange={(event) => {
                // The select only offers PROVIDERS entries, so the emitted
                // value always resolves to one of them.
                const provider = PROVIDERS.find(
                  (option) => option === event.target.value,
                )
                if (provider) updateLink(link.id, { provider })
              }}
            >
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {providerLabel(provider)}
                </option>
              ))}
            </select>
            <input
              aria-label={`Link ${index + 1} label`}
              placeholder="Label"
              maxLength={40}
              value={link.label}
              onChange={(event) =>
                updateLink(link.id, { label: event.target.value })
              }
            />
            <input
              aria-label={`Link ${index + 1} URL`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={link.url}
              onChange={(event) =>
                updateLink(link.id, { url: event.target.value })
              }
            />
            <div className="public-profile-link-actions">
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Move ${link.label || `link ${index + 1}`} up`}
                onClick={() => moveLink(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === links.length - 1}
                aria-label={`Move ${link.label || `link ${index + 1}`} down`}
                onClick={() => moveLink(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="remove"
                aria-label={`Remove ${link.label || `link ${index + 1}`}`}
                onClick={() =>
                  setLinks((current) =>
                    current.filter((item) => item.id !== link.id),
                  )
                }
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="public-profile-publish-row">
        <div>
          <h3>Publish profile</h3>
          <p>
            {published
              ? 'Anyone with your link or QR can see it.'
              : 'Only you can see this draft.'}
          </p>
        </div>
        <button
          className={`switch${published ? ' is-on' : ''}`}
          type="button"
          role="switch"
          aria-label="Publish public profile"
          aria-checked={published}
          onClick={() => setPublished((current) => !current)}
        >
          <span />
        </button>
      </div>

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="public-profile-success" role="status">
          {message}
        </p>
      ) : null}

      <div className="public-profile-footer-actions">
        <button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {published ? (
          <a href={profile.profileUrl} target="_blank" rel="noreferrer">
            Open public profile ↗
          </a>
        ) : (
          <span>Publish to open your public profile</span>
        )}
      </div>
    </div>
  )
}
