import type { Eip1193Provider } from '@beegreat/wallet-connect';
import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';

import { isWalletConnectConfigured } from '@/lib/wallet-connect';

export function useEoaWallet() {
  const { open, disconnect } = useAppKit();
  const account = useAccount();
  const { provider, providerType } = useProvider();
  const connectedToEvm = account.isConnected && providerType === 'eip155';

  return {
    address: connectedToEvm ? account.address : undefined,
    isConnected: connectedToEvm,
    provider: connectedToEvm
      ? (provider as Eip1193Provider | undefined)
      : undefined,
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
