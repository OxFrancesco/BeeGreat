import { SignInButton } from '@clerk/tanstack-react-start'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'

export function Landing() {
  return (
    <main className="landing">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="BeeGreat home">
          <img src="/logo.png" alt="" />
          <span>BeeGreat</span>
        </a>
        <SignInButton mode="modal">
          <button
            type="button"
            className="button button--quiet landing-sign-in"
          >
            Sign in
          </button>
        </SignInButton>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-eyebrow">
            <span aria-hidden="true" />
            Your focus, already in sync
          </p>
          <h1>
            One clear thing.
            <br />
            <em>Then the next.</em>
          </h1>
          <p className="landing-lede">
            Talk to Bee about what matters. Turn an intention into a Goal,
            choose today’s Highlight, and watch your Hive fill as you move.
          </p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="button button--primary landing-cta"
            >
              Open your Hive
              <span aria-hidden="true">→</span>
            </button>
          </SignInButton>
          <p className="landing-fineprint">
            Your mobile conversations, goals, and progress meet you here.
          </p>
        </div>

        <div className="landing-stage" aria-hidden="true">
          <div className="landing-comb landing-comb--one" />
          <div className="landing-comb landing-comb--two" />
          <div className="landing-comb landing-comb--three" />
          <div className="landing-orbit" />
          <img src={beeUrl} alt="" className="landing-bee" />
          <div className="landing-focus-card">
            <span>Today’s Highlight</span>
            <strong>Ship the work that matters</strong>
            <div>
              <i />
              In focus
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
