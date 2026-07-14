import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/tanstack-react-start'
import { useEffect, useRef } from 'react'

import beeIcon from '../../../../mobile/assets/icons/bee.svg?url'
import goalsIcon from '../../../../mobile/assets/icons/honeycomb.svg?url'
import hiveIcon from '../../../../mobile/assets/icons/hive.svg?url'
import micIcon from '../../../../mobile/assets/icons/mic-honey.svg?url'
import { useBeeAgentContext } from '../bee/bee-agent-context'

const NAVIGATION = [
  { to: '/bee', label: 'Bee', icon: beeIcon },
  { to: '/goals', label: 'Goals', icon: goalsIcon },
  { to: '/hive', label: 'Hive', icon: hiveIcon },
] as const

export function AppShell() {
  const agent = useBeeAgentContext()
  const { user } = useUser()
  const navigate = useNavigate()
  const wasRecording = useRef(false)
  const voiceState = agent.recording
    ? 'Listening'
    : agent.transcribing || agent.busy
      ? 'Thinking'
      : agent.speaking
        ? 'Speaking'
        : agent.speechBlocked
          ? 'Reply ready'
          : undefined

  useEffect(() => {
    if (wasRecording.current && !agent.recording) {
      void navigate({ to: '/bee' })
    }
    wasRecording.current = agent.recording
  }, [agent.recording, navigate])

  return (
    <div className="app-shell">
      <aside className="hive-spine">
        <Link className="spine-brand" to="/bee" aria-label="BeeGreat home">
          <img src={beeIcon} alt="" />
          <span>BeeGreat</span>
        </Link>

        <nav className="spine-nav" aria-label="Main navigation">
          {NAVIGATION.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="spine-link"
              activeProps={{ className: 'spine-link is-active' }}
            >
              <img src={item.icon} alt="" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <button
          className={`spine-talk${agent.recording ? ' is-recording' : ''}`}
          type="button"
          aria-label={
            agent.recording ? 'Stop recording and send voice' : 'Talk to Bee'
          }
          aria-pressed={agent.recording}
          onClick={() => {
            void navigate({ to: '/bee' })
            void agent.toggleRecording()
          }}
        >
          <img src={micIcon} alt="" />
          <span>{agent.recording ? 'Send voice' : 'Talk'}</span>
        </button>

        <Link
          className="spine-profile"
          to="/settings"
          aria-label="Open profile and settings"
          activeProps={{ className: 'spine-profile is-active' }}
        >
          {user?.hasImage ? (
            <img src={user.imageUrl} alt="" />
          ) : (
            <span aria-hidden="true">
              {(
                user?.firstName ??
                user?.primaryEmailAddress?.emailAddress ??
                'B'
              )
                .slice(0, 1)
                .toUpperCase()}
            </span>
          )}
          <strong>{user?.firstName ?? 'Profile'}</strong>
        </Link>
      </aside>

      <div className="app-stage">
        <Outlet />
      </div>

      {voiceState ? (
        <button
          className="voice-island"
          type="button"
          aria-live="polite"
          aria-label={`Bee voice status: ${voiceState}. Open Bee.`}
          onClick={() => void navigate({ to: '/bee' })}
        >
          <span className="voice-island__dot" />
          {voiceState}
        </button>
      ) : null}
    </div>
  )
}
