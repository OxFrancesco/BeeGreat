import { SignInButton } from '@clerk/tanstack-react-start'

import beeUrl from '../../../../mobile/assets/images/bee.webp?url'
import honeypotUrl from '../../../../mobile/assets/images/honeypot.svg?url'

export function Landing() {
  return (
    <main className="landing">
      <section className="landing-card" aria-labelledby="landing-title">
        <div className="landing-art" aria-hidden="true">
          <img src={honeypotUrl} alt="" />
        </div>

        <div className="landing-copy">
          <img src={beeUrl} alt="" className="landing-bee" />
          <h1 id="landing-title">BeeGreat</h1>
          <p>
            One hive for your goals.
            <br />
            Talk, plan, and make every day count.
          </p>
        </div>

        <div className="landing-actions">
          <SignInButton mode="modal">
            <button type="button" className="landing-sign-in">
              Sign in with Google
            </button>
          </SignInButton>
          <p>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </section>
    </main>
  )
}
