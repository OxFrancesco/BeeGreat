import { Navigate, createFileRoute } from '@tanstack/react-router'
import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'

import { Landing } from '~/features/bee/landing'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <>
      <SignedIn>
        <Navigate to="/bee" replace />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  )
}
