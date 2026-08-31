import type { Eip1193Provider } from '@beegreat/wallet-connect';

/** The wallet surface shared by the native and web variants of this hook. */
type EoaWallet = {
  address: string | undefined;
  isConnected: boolean;
  provider: Eip1193Provider | undefined;
  isConfigured: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export function useEoaWallet(): EoaWallet {
  return {
    address: undefined,
    isConnected: false,
    provider: undefined,
    isConfigured: false,
    connect: async () => {
      throw new Error('WalletConnect is only available in the mobile app.');
    },
    disconnect: async () => {},
  };
}
