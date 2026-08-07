import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from '@reown/appkit/react'

import type { Eip1193Provider } from '@beegreat/wallet-connect'
import { isWalletConnectConfigured } from '~/lib/wallet-connect'

export function useEoaWallet() {
  const { open } = useAppKit()
  const account = useAppKitAccount({ namespace: 'eip155' })
  const { walletProvider } = useAppKitProvider<Eip1193Provider>('eip155')
  const { disconnect } = useDisconnect()

  return {
    address: account.address,
    isConnected: account.isConnected,
    provider: account.isConnected ? walletProvider : undefined,
    isConfigured: isWalletConnectConfigured,
    connect: async () => {
      if (!isWalletConnectConfigured) {
        throw new Error(
          'WalletConnect is not configured for this BeeGreat app.',
        )
      }
      await open({ view: 'Connect', namespace: 'eip155' })
    },
    disconnect: async () => {
      await disconnect({ namespace: 'eip155' })
    },
  }
}
