import { api } from '@beegreat/backend/convex/_generated/api'
import { useMutation, useQuery } from 'convex/react'
import { ExternalLinkIcon, Globe2Icon, SparklesIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useBeeAgentContext } from '../bee/bee-agent-context'
import type { Id } from '@beegreat/backend/convex/_generated/dataModel'
import { captureWebFailure } from '~/lib/sentry'

type BeeSite = {
  siteId: Id<'beeSites'>
  slug: string
  title: string
  description: string | null
  status: 'draft' | 'published' | 'unpublished' | 'suspended'
  pageCount: number
  publicUrl: string
  updatedAt: number
}

export function siteCreationPrompt(title: string, brief: string) {
  return `Use Astro Creator to create my Bee Site named "${title.trim()}". Build this: ${brief.trim()} Create a checked review preview and give me its link. Do not publish it yet.`
}

export function siteEditPrompt(title: string, change: string) {
  return `Use Astro Creator to edit my existing Bee Site named "${title}". Requested change: ${change.trim()} Create a checked review preview and give me its link. Do not publish the changes yet.`
}

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function SitesPage() {
  const result = useQuery(api.beeSites.listMine)
  const agent = useBeeAgentContext()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [error, setError] = useState<string>()
  const sites = result?.sites ?? []
  const siteLimitReached = Boolean(
    result && sites.length >= result.limits.sites,
  )

  async function askBee(prompt: string) {
    setError(undefined)
    try {
      await navigate({ to: '/bee' })
      await agent.sendText(prompt)
    } catch (cause) {
      captureWebFailure(cause, 'bee_sites.ask_bee')
      setError(messageFor(cause, 'Bee could not start this site yet.'))
    }
  }

  async function createPreview() {
    const cleanTitle = title.trim()
    const cleanBrief = brief.trim()
    if (!cleanTitle || !cleanBrief) {
      setError('Give the site a name and tell Bee what it should become.')
      return
    }
    await askBee(siteCreationPrompt(cleanTitle, cleanBrief))
  }

  return (
    <main className="product-page sites-page">
      <header className="sites-hero">
        <div className="sites-hero__mark" aria-hidden="true">
          <Globe2Icon />
        </div>
        <div>
          <p className="utility-label">Bee Sites</p>
          <h1>A little corner of the web, made with Bee.</h1>
          <p>
            Describe the page you need. Astro Creator designs it, checks it, and
            gives you a private preview before anything goes live.
          </p>
        </div>
      </header>

      <section className="site-compose" aria-labelledby="new-site-heading">
        <div className="site-compose__heading">
          <div>
            <p className="utility-label">Start something</p>
            <h2 id="new-site-heading">What should we make?</h2>
          </div>
          {result ? (
            <span className="site-capacity">
              {sites.length} of {result.limits.sites} sites
            </span>
          ) : null}
        </div>

        <label>
          <span>Site name</span>
          <input
            value={title}
            maxLength={80}
            placeholder="Oddo Studio"
            disabled={siteLimitReached || agent.busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>Brief</span>
          <textarea
            value={brief}
            rows={4}
            maxLength={2_000}
            placeholder="A quiet portfolio for my product work, with an about page and a way to reach me."
            disabled={siteLimitReached || agent.busy}
            onChange={(event) => setBrief(event.target.value)}
          />
        </label>

        <div className="site-compose__footer">
          <p>
            {result
              ? `${result.limits.pagesPerSite} pages per site · ${result.limits.generationsPerMonth} builds each month`
              : 'Loading your site allowance…'}
          </p>
          <button
            className="button button--primary site-build-button"
            type="button"
            disabled={siteLimitReached || agent.busy || !result}
            onClick={() => void createPreview()}
          >
            <SparklesIcon aria-hidden="true" />
            {agent.busy ? 'Bee is working…' : 'Create a preview'}
          </button>
        </div>
        {siteLimitReached ? (
          <p className="site-notice">
            Your {result?.limits.tier === 'pro' ? 'Pro' : 'free'} site spaces
            are full. You can keep improving the sites below.
          </p>
        ) : null}
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="sites-library" aria-labelledby="your-sites-heading">
        <div className="sites-library__heading">
          <div>
            <p className="utility-label">Your places</p>
            <h2 id="your-sites-heading">Bee Sites</h2>
          </div>
          {result ? (
            <span>
              {result.limits.tier === 'pro' ? 'Pro studio' : 'Free studio'}
            </span>
          ) : null}
        </div>

        {result === undefined ? (
          <div className="sites-loading">Opening your studio…</div>
        ) : sites.length ? (
          <div className="site-list">
            {sites.map((site) => (
              <SiteCard key={site.siteId} site={site} askBee={askBee} />
            ))}
          </div>
        ) : (
          <div className="sites-empty">
            <span aria-hidden="true">01</span>
            <div>
              <h3>Your first site starts with a sentence.</h3>
              <p>
                Give Bee the name, audience, and feeling. You will review every
                page before choosing to publish.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

function SiteCard({
  site,
  askBee,
}: {
  site: BeeSite
  askBee: (prompt: string) => Promise<void>
}) {
  const save = useMutation(api.beeSites.save)
  const unpublish = useMutation(api.beeSites.unpublish)
  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState(false)
  const [change, setChange] = useState('')
  const [title, setTitle] = useState(site.title)
  const [slug, setSlug] = useState(site.slug)
  const [description, setDescription] = useState(site.description ?? '')
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    setTitle(site.title)
    setSlug(site.slug)
    setDescription(site.description ?? '')
  }, [site.description, site.slug, site.title])

  async function saveDetails() {
    setWorking(true)
    setMessage(undefined)
    try {
      await save({
        siteId: site.siteId,
        title,
        slug,
        description: description || undefined,
      })
      setEditing(false)
      setMessage('Details saved.')
    } catch (cause) {
      captureWebFailure(cause, 'bee_sites.save')
      setMessage(messageFor(cause, 'Could not save these details.'))
    } finally {
      setWorking(false)
    }
  }

  async function takeOffline() {
    setWorking(true)
    setMessage(undefined)
    try {
      await unpublish({ siteId: site.siteId })
      setMessage('Site taken offline. Its files are still safe.')
    } catch (cause) {
      captureWebFailure(cause, 'bee_sites.unpublish')
      setMessage(messageFor(cause, 'Could not take this site offline.'))
    } finally {
      setWorking(false)
    }
  }

  async function requestEdit() {
    if (!change.trim()) {
      setMessage('Tell Bee what you want to change first.')
      return
    }
    await askBee(siteEditPrompt(site.title, change))
  }

  return (
    <article className="site-card">
      <div className="site-card__topline">
        <span className={`site-status is-${site.status}`}>
          {site.status === 'published' ? 'Live' : site.status}
        </span>
        <span>
          {site.pageCount} {site.pageCount === 1 ? 'page' : 'pages'}
        </span>
      </div>
      <div className="site-card__identity">
        <div>
          <h3>{site.title}</h3>
          <p>{site.description || 'A Bee Site waiting for its next detail.'}</p>
        </div>
        {site.status === 'published' ? (
          <a href={site.publicUrl} target="_blank" rel="noreferrer">
            Open site <ExternalLinkIcon aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <p className="site-address">sites.buddytools.org/{site.slug}</p>

      <div className="site-change-request">
        <label htmlFor={`change-${site.siteId}`}>What should Bee change?</label>
        <div>
          <input
            id={`change-${site.siteId}`}
            value={change}
            maxLength={1_000}
            placeholder="Add a speaking page and warm up the colors"
            onChange={(event) => setChange(event.target.value)}
          />
          <button type="button" onClick={() => void requestEdit()}>
            Ask Bee
          </button>
        </div>
      </div>

      {editing ? (
        <div className="site-details-editor">
          <label>
            <span>Name</span>
            <input
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            <span>Address</span>
            <input
              value={slug}
              maxLength={48}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <label className="site-details-editor__description">
            <span>Description</span>
            <textarea
              value={description}
              rows={2}
              maxLength={240}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="site-details-editor__actions">
            <button
              type="button"
              disabled={working}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => void saveDetails()}
            >
              {working ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </div>
      ) : (
        <div className="site-card__actions">
          <button type="button" onClick={() => setEditing(true)}>
            Edit details
          </button>
          {site.status === 'published' ? (
            <button
              className="site-card__unpublish"
              type="button"
              disabled={working}
              onClick={() => void takeOffline()}
            >
              Take offline
            </button>
          ) : null}
        </div>
      )}
      {message ? <p className="site-card__message">{message}</p> : null}
    </article>
  )
}
