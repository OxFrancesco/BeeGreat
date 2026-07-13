import { createContext, useContext } from 'react'

import { useBeeAgent } from './use-bee-agent'
import type { PropsWithChildren } from 'react'

type BeeAgent = ReturnType<typeof useBeeAgent>

const BeeAgentContext = createContext<BeeAgent | null>(null)

export function BeeAgentProvider({ children }: PropsWithChildren) {
  const agent = useBeeAgent()
  return (
    <BeeAgentContext.Provider value={agent}>
      {children}
    </BeeAgentContext.Provider>
  )
}

export function useBeeAgentContext() {
  const agent = useContext(BeeAgentContext)
  if (!agent) {
    throw new Error('useBeeAgentContext must be used inside BeeAgentProvider')
  }
  return agent
}
