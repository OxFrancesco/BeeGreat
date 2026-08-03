import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { walletAppKit } from '@/lib/wallet-connect';

export function WalletAppKit({ children }: PropsWithChildren) {
  return (
    <AppKitProvider instance={walletAppKit}>
      {children}
      <View pointerEvents="box-none" style={styles.modal}>
        <AppKit />
      </View>
    </AppKitProvider>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    inset: 0,
  },
});
