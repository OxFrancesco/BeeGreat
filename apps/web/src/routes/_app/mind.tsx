import { createFileRoute } from '@tanstack/react-router'

import { MindPage } from '~/features/mind/mind-page'

export const Route = createFileRoute('/_app/mind')({
  component: MindPage,
  errorComponent: MindError,
})

function MindError({ reset }: { reset: () => void }) {
  return (
    <main className="mind-route-error" role="alert">
      <span aria-hidden="true">⬡</span>
      <h1>Your Mind is out of reach</h1>
      <p>Check your connection, then try opening it again.</p>
      <button className="button button--primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
