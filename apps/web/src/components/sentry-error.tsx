import * as Sentry from '@sentry/tanstackstart-react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'

export function SentryErrorComponent({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      mechanism: { type: 'tanstack-router.error-component', handled: true },
    })
  }, [error])

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Bee hit an unexpected problem.</h1>
      <p className="text-balance text-neutral-600">
        The failure was reported. Try loading this view again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-amber-400 px-5 py-3 font-semibold text-neutral-950"
      >
        Try again
      </button>
    </main>
  )
}
