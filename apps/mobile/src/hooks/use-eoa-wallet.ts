import type { Eip1193Provider } from '@beegreat/wallet-connect';
import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';

import { isWalletConnectConfigured } from '@/lib/wallet-connect';

export function useEoaWallet() {
  const { open, disconnect } = useAppKit();
  const account = useAccount();
  const { provider, providerType } = useProvider();
  const connectedToEvm = account.isConnected && providerType === 'eip155';
  // SAFETY: When AppKit reports providerType 'eip155' the active provider
  // speaks EIP-1193 — that is what the eip155 namespace guarantees.
  const eip1193Provider = connectedToEvm
    ? (provider as Eip1193Provider | undefined)
    : undefined;

  return {
    address: connectedToEvm ? account.address : undefined,
    isConnected: connectedToEvm,
    provider: eip1193Provider,
    isConfigured: isWalletConnectConfigured,
    connect: async () => {
      if (!isWalletConnectConfigured) {
        throw new Error(
          'WalletConnect is not configured for this BeeGreat app.',
        );
      }
      await open({ view: 'Connect' });
    },
    disconnect: async () => {
      await disconnect('eip155');
    },
  };
}
