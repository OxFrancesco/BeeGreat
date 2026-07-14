import { createFileRoute } from '@tanstack/react-router'

import { HivePage } from '~/features/hive/hive-page'

export const Route = createFileRoute('/_app/hive')({
  component: HivePage,
  errorComponent: HiveError,
})

function HiveError({ reset }: { reset: () => void }) {
  return (
    <main className="hive-error" role="alert">
      <span aria-hidden="true">⬡</span>
      <h1>The Hive is out of reach</h1>
      <p>Check your connection and try gathering it again.</p>
      <button className="button button--primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
