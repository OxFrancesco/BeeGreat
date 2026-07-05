import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <img src="/logo.png" alt="BeeGreat" className="h-48 w-auto" />
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">BeeGreat</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Talk to Bee about your goals, your tasks, or where your time went today.
        </p>
      </div>
    </main>
  )
}
