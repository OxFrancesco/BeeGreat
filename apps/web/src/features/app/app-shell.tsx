import { useUser } from '@clerk/tanstack-react-start'
import { Link, Outlet, useNavigate } from '@tanstack/react-router'
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys'
import { useEffect, useRef, useState } from 'react'

import beeIcon from '../../../../mobile/assets/icons/bee.svg?url'
import goalsIcon from '../../../../mobile/assets/icons/honeycomb.svg?url'
import hiveIcon from '../../../../mobile/assets/icons/hive.svg?url'
import { useHotkeyBindings } from '../preferences/hotkeys'
import { useBeeAgentContext } from '../bee/bee-agent-context'
import type { HotkeyAction } from '../preferences/hotkeys'

const NAVIGATION = [
  { to: '/goals', label: 'Goals', icon: goalsIcon, action: 'goals' },
  { to: '/hive', label: 'Hive', icon: hiveIcon, action: 'hive' },
  { to: '/mind', label: 'Mind', icon: goalsIcon, action: 'mind' },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  icon: string
  action: HotkeyAction
}>

export function AppShell() {
  const agent = useBeeAgentContext()
  const { user } = useUser()
  const navigate = useNavigate()
  const wasRecording = useRef(false)
  const lastScrollTop = useRef(0)
  const lastScrollTarget = useRef<EventTarget | null>(null)
  const bindings = useHotkeyBindings()
  // Hotkey hints are platform-formatted (⌘ vs Ctrl), so render them only
  // after mount to keep server and client markup identical.
  const [showHints, setShowHints] = useState(false)
  const [navDocked, setNavDocked] = useState(false)
  const voiceState = agent.recording
    ? 'Listening'
    : agent.transcribing || agent.busy
      ? 'Thinking'
      : agent.speaking
        ? 'Speaking'
        : agent.speechBlocked
          ? 'Reply ready'
          : undefined

  useEffect(() => setShowHints(true), [])

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target
      const scrollTop =
        target === document
          ? (document.scrollingElement?.scrollTop ?? 0)
          : target instanceof HTMLElement
            ? target.scrollTop
            : 0

      if (lastScrollTarget.current !== target) {
        lastScrollTarget.current = target
        lastScrollTop.current = scrollTop
      }

      const movingDown = scrollTop > lastScrollTop.current + 6
      if (scrollTop <= 40) {
        setNavDocked(false)
      } else if (movingDown || scrollTop > 120) {
        setNavDocked(true)
      }
      lastScrollTop.current = scrollTop
    }

    document.addEventListener('scroll', handleScroll, true)
    return () => document.removeEventListener('scroll', handleScroll, true)
  }, [])

  useEffect(() => {
    if (wasRecording.current && !agent.recording) {
      void navigate({ to: '/bee' })
    }
    wasRecording.current = agent.recording
  }, [agent.recording, navigate])

  function startTalking() {
    void navigate({ to: '/bee' })
    void agent.toggleRecording()
  }

  useHotkey(bindings.bee, () => void navigate({ to: '/bee' }), {
    preventDefault: true,
  })
  useHotkey(bindings.goals, () => void navigate({ to: '/goals' }), {
    preventDefault: true,
  })
  useHotkey(bindings.hive, () => void navigate({ to: '/hive' }), {
    preventDefault: true,
  })
  useHotkey(bindings.mind, () => void navigate({ to: '/mind' }), {
    preventDefault: true,
  })
  useHotkey(bindings.settings, () => void navigate({ to: '/settings' }), {
    preventDefault: true,
  })
  useHotkey(bindings.talk, startTalking, { preventDefault: true })

  return (
    <div className="app-shell">
      <header
        className={`glass-nav${navDocked ? ' is-docked' : ''}`}
        aria-label="BeeGreat"
      >
        <Link
          className="glass-nav__brand"
          to="/bee"
          aria-label="Bee"
          activeProps={{ className: 'glass-nav__brand is-active' }}
          title={
            showHints
              ? `Bee — ${formatForDisplay(bindings.bee)}`
              : 'BeeGreat home'
          }
        >
          <img src={beeIcon} alt="" />
          <span>BeeGreat</span>
        </Link>

        <nav className="glass-nav__links" aria-label="Main navigation">
          {NAVIGATION.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="glass-nav__link"
              activeProps={{ className: 'glass-nav__link is-active' }}
              title={
                showHints
                  ? `${item.label} — ${formatForDisplay(bindings[item.action])}`
                  : item.label
              }
            >
              <img src={item.icon} alt="" />
              <span>{item.label}</span>
              {showHints ? (
                <kbd aria-hidden="true">
                  {formatForDisplay(bindings[item.action])}
                </kbd>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="glass-nav__actions">
          <Link
            className="glass-nav__profile"
            to="/settings"
            aria-label="Open profile and settings"
            activeProps={{ className: 'glass-nav__profile is-active' }}
            title={
              showHints
                ? `Settings — ${formatForDisplay(bindings.settings)}`
                : 'Settings'
            }
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
          </Link>
        </div>
      </header>

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
