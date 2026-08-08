import { api } from '@beegreat/backend/convex/_generated/api'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'

type Job = FunctionReturnType<typeof api.agentJobs.list>[number]

function formatDate(timestamp?: number) {
  if (!timestamp) return 'No upcoming run'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function describeSchedule(schedule: Job['schedule']) {
  if (schedule.kind === 'once') return `Once · ${formatDate(schedule.at)}`
  if (schedule.kind === 'interval') {
    const minutes = schedule.everyMs / 60_000
    if (minutes % 1_440 === 0)
      return `Every ${minutes / 1_440} day${minutes === 1_440 ? '' : 's'}`
    if (minutes % 60 === 0)
      return `Every ${minutes / 60} hour${minutes === 60 ? '' : 's'}`
    return `Every ${minutes} minutes`
  }
  return `Every ${schedule.interval === 1 ? '' : `${schedule.interval} `}${schedule.frequency.replace('daily', 'day').replace('weekly', 'week').replace('monthly', 'month').replace('yearly', 'year')} · ${schedule.timeZone}`
}

function stateLabel(job: Job) {
  if (job.status === 'active' && job.consecutiveFailures > 0) {
    return `${job.consecutiveFailures} recent failure${job.consecutiveFailures === 1 ? '' : 's'}`
  }
  return job.status.replace('_', ' ')
}

export function JobsPage() {
  const jobs = useQuery(api.agentJobs.list)
  const grants = useQuery(api.agentJobGrants.list)
  const pause = useMutation(api.agentJobs.pause)
  const resume = useMutation(api.agentJobs.resume)
  const cancel = useMutation(api.agentJobs.cancel)
  const runNow = useMutation(api.agentJobs.runNow)
  const approveGrant = useMutation(api.agentJobGrants.approve)
  const revokeGrant = useMutation(api.agentJobGrants.revoke)
  const [workingId, setWorkingId] = useState<string>()
  const [error, setError] = useState<string>()

  async function perform(
    job: Job,
    action: 'pause' | 'resume' | 'cancel' | 'run',
  ) {
    if (workingId) return
    if (
      action === 'cancel' &&
      !window.confirm(`Cancel “${job.title}”? It cannot be resumed.`)
    )
      return
    setWorkingId(job.id)
    setError(undefined)
    try {
      if (action === 'pause') await pause({ jobId: job.id })
      else if (action === 'resume') await resume({ jobId: job.id })
      else if (action === 'cancel') await cancel({ jobId: job.id })
      else await runNow({ jobId: job.id })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Bee could not update this Job.',
      )
    } finally {
      setWorkingId(undefined)
    }
  }

  async function updateGrant(job: Job, action: 'approve' | 'revoke') {
    const grant = grants?.find((item) => item.jobId === job.id)
    if (!grant || workingId) return
    const actions = grant.allowedActions
      .map((item) => item.replace('_', ' '))
      .join(', ')
    const approved =
      action === 'approve'
        ? window.confirm(
            `Approve “${job.title}” to perform ${actions} on pool ${grant.poolAddress.slice(0, 6)}…${grant.poolAddress.slice(-4)} for 30 days?`,
          )
        : window.confirm(`Revoke recurring wallet access for “${job.title}”?`)
    if (!approved) return
    setWorkingId(job.id)
    setError(undefined)
    try {
      if (action === 'approve') await approveGrant({ jobId: job.id })
      else await revokeGrant({ jobId: job.id })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Bee could not update wallet access.',
      )
    } finally {
      setWorkingId(undefined)
    }
  }

  return (
    <main className="product-page jobs-page">
      <header className="product-header jobs-header">
        <div>
          <p className="utility-label">Agent Jobs</p>
          <h1>Bee, on your schedule</h1>
          <p>
            Durable instructions that keep their own conversation and run across
            every device.
          </p>
        </div>
        <Link className="button button--primary jobs-create" to="/bee">
          Ask Bee to make a Job
        </Link>
      </header>

      {error ? (
        <p className="jobs-error" role="alert">
          {error}
        </p>
      ) : null}

      {jobs === undefined ? (
        <div className="jobs-empty" aria-busy="true">
          Loading your Jobs…
        </div>
      ) : jobs.length === 0 ? (
        <section className="jobs-empty">
          <span className="jobs-empty__comb" aria-hidden="true">
            ⌁
          </span>
          <h2>No Jobs yet</h2>
          <p>
            Tell Bee what to do and when—like “ping me on Telegram every two
            hours.”
          </p>
          <Link className="button button--quiet" to="/bee">
            Talk to Bee
          </Link>
        </section>
      ) : (
        <div className="jobs-grid">
          {jobs.map((job) => {
            const working = workingId === job.id
            const grant = grants?.find((item) => item.jobId === job.id)
            const grantStatus =
              grant?.status === 'active' &&
              grant.expiresAt !== undefined &&
              grant.expiresAt <= Date.now()
                ? 'expired'
                : grant?.status
            return (
              <article className="job-card" key={job.id}>
                <div className="job-card__topline">
                  <span className={`job-status job-status--${job.status}`}>
                    {stateLabel(job)}
                  </span>
                  <span className="job-delivery">
                    {job.delivery.includes('telegram')
                      ? 'App + Telegram'
                      : 'App'}
                  </span>
                </div>
                <h2>{job.title}</h2>
                <p className="job-card__instruction">{job.instruction}</p>
                <dl className="job-card__timing">
                  <div>
                    <dt>Schedule</dt>
                    <dd>{describeSchedule(job.schedule)}</dd>
                  </div>
                  <div>
                    <dt>Next run</dt>
                    <dd>{formatDate(job.nextRunAt)}</dd>
                  </div>
                </dl>
                {grant ? (
                  <div className="job-grant">
                    <div>
                      <strong>Scoped wallet access</strong>
                      <span>
                        {grant.allowedActions
                          .map((item) => item.replace('_', ' '))
                          .join(' · ')}{' '}
                        · {grant.poolAddress.slice(0, 6)}…
                        {grant.poolAddress.slice(-4)}
                      </span>
                    </div>
                    {grantStatus === 'pending' || grantStatus === 'expired' ? (
                      <button
                        className="job-grant__approve"
                        disabled={working}
                        onClick={() => void updateGrant(job, 'approve')}
                      >
                        Approve 30 days
                      </button>
                    ) : grantStatus === 'active' ? (
                      <button
                        className="job-grant__revoke"
                        disabled={working}
                        onClick={() => void updateGrant(job, 'revoke')}
                      >
                        Revoke
                      </button>
                    ) : (
                      <span className="job-grant__revoked">Revoked</span>
                    )}
                  </div>
                ) : null}
                <div className="job-card__actions">
                  {job.status === 'active' ? (
                    <button
                      className="button button--quiet"
                      disabled={working}
                      onClick={() => void perform(job, 'pause')}
                    >
                      Pause
                    </button>
                  ) : job.status === 'paused' ? (
                    <button
                      className="button button--quiet"
                      disabled={working}
                      onClick={() => void perform(job, 'resume')}
                    >
                      Resume
                    </button>
                  ) : null}
                  {job.status !== 'cancelled' ? (
                    <button
                      className="button button--quiet"
                      disabled={working}
                      onClick={() => void perform(job, 'run')}
                    >
                      Run now
                    </button>
                  ) : null}
                  {job.status !== 'cancelled' && job.status !== 'completed' ? (
                    <button
                      className="job-cancel"
                      disabled={working}
                      onClick={() => void perform(job, 'cancel')}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
