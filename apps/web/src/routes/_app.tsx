import { createFileRoute, redirect } from '@tanstack/react-router'

import { AppShell } from '~/features/app/app-shell'
import { ChatGptAuthGate } from '~/features/auth/chatgpt-auth'
import { BeeAgentProvider } from '~/features/bee/bee-agent-context'

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.userId) throw redirect({ to: '/' })
  },
  component: AuthenticatedApp,
})

function AuthenticatedApp() {
  return (
    <ChatGptAuthGate>
      <BeeAgentProvider>
        <AppShell />
      </BeeAgentProvider>
    </ChatGptAuthGate>
  )
}
