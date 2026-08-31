import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import {
  arbitrum,
  base,
  celo,
  fraxtal,
  ink,
  lisk,
  mode,
  optimism,
  soneium,
  superseed,
  unichain,
} from '@reown/appkit/networks'

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim() ?? ''

export const isWalletConnectConfigured = projectId.length > 0

// TanStack Start evaluates this module while rendering on the server. AppKit
// initialization belongs to the browser, while the exported configuration flag
// remains safe for both environments.
if ('window' in globalThis) {
  createAppKit({
    adapters: [new EthersAdapter()],
    projectId: projectId || 'beegreat-wallet-connect-not-configured',
    networks: [
      base,
      arbitrum,
      optimism,
      unichain,
      fraxtal,
      lisk,
      soneium,
      superseed,
      mode,
      celo,
      ink,
    ],
    defaultNetwork: base,
    metadata: {
      name: 'BeeGreat',
      description: 'Link your wallet to sign BeeGreat transaction plans.',
      url: window.location.origin,
      icons: [`${window.location.origin}/apple-touch-icon.png`],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
    themeVariables: {
      '--w3m-accent': '#644a40',
      '--w3m-border-radius-master': '2px',
    },
  })
}
