import { createFileRoute } from '@tanstack/react-router'
import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'

import { BeeWorkspace } from '~/features/bee/bee-workspace'
import { Landing } from '~/features/bee/landing'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <>
      <SignedIn>
        <BeeWorkspace />
      </SignedIn>
      <SignedOut>
        <Landing />
      </SignedOut>
    </>
  )
}
