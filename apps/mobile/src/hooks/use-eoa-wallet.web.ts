import type { Eip1193Provider } from '@beegreat/wallet-connect';

export function useEoaWallet() {
  return {
    address: undefined as string | undefined,
    isConnected: false,
    provider: undefined as Eip1193Provider | undefined,
    isConfigured: false,
    connect: async () => {
      throw new Error('WalletConnect is only available in the mobile app.');
    },
    disconnect: async () => {},
  };
}
