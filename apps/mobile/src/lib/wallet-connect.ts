import '@walletconnect/react-native-compat';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAppKit, type Storage } from '@reown/appkit-react-native';
import { EthersAdapter } from '@reown/appkit-ethers-react-native';
import * as Clipboard from 'expo-clipboard';
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
} from 'viem/chains';

const configuredProjectId =
  process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim() ?? '';

export const isWalletConnectConfigured = configuredProjectId.length > 0;

const storage: Storage = {
  async getKeys() {
    return [...(await AsyncStorage.getAllKeys())];
  },
  async getEntries<T>() {
    const entries = await AsyncStorage.multiGet(
      await AsyncStorage.getAllKeys(),
    );
    return entries.flatMap(([key, value]): [string, T][] => {
      if (value === null) return [];
      try {
        // SAFETY: AppKit only reads back values it wrote through `setItem`
        // (JSON.stringify of a `T`), so the parsed JSON is the stored `T`.
        const parsed = JSON.parse(value) as T;
        return [[key, parsed]];
      } catch {
        return [];
      }
    });
  },
  async getItem<T>(key: string) {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return undefined;
    // SAFETY: AppKit only reads back values it wrote through `setItem`
    // (JSON.stringify of a `T`), so the parsed JSON is the stored `T`.
    return JSON.parse(value) as T;
  },
  async setItem<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};

export const walletAppKit = createAppKit({
  projectId: configuredProjectId || 'beegreat-wallet-connect-not-configured',
  adapters: [new EthersAdapter()],
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
  storage,
  metadata: {
    name: 'BeeGreat',
    description: 'Link your wallet to sign BeeGreat transaction plans.',
    url: 'https://beegreat.app',
    icons: ['https://beegreat.app/apple-touch-icon.png'],
    redirect: {
      native: 'beegreat://',
      universal: 'https://beegreat.app',
    },
  },
  clipboardClient: {
    setString: async (value) => {
      await Clipboard.setStringAsync(value);
    },
  },
  features: {
    swaps: false,
    onramp: false,
    socials: false,
  },
  enableAnalytics: false,
  logger: __DEV__ ? 'error' : 'silent',
  themeVariables: { accent: '#644a40' },
});
