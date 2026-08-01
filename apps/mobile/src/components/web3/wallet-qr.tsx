import { api } from '@beegreat/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HoneyQrCode } from '@/components/honey-qr-code';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The Bee smart wallet address, or null while loading / before creation. */
export function useSmartWalletAddress() {
  const wallets = useQuery(api.wallets.myWallets);
  return wallets?.smartWallet?.address ?? null;
}

/** Wallet-compatible wrapper around the shared BeeGreat QR renderer. */
export function WalletQrCode({ address, size }: { address: string; size: number }) {
  return <HoneyQrCode value={address} size={size} />;
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Framed wallet QR with the shortened address underneath; tapping the
 * address copies it. Shared by the chat balance popover and the profile
 * Wallets card.
 */
export function WalletQrCard({
  address,
  chain,
  size = 216,
}: {
  address: string;
  chain?: string;
  size?: number;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    Haptics.selectionAsync();
    await Clipboard.setStringAsync(address);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.frame}>
        <WalletQrCode address={address} size={size} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Copy wallet address"
        hitSlop={Spacing.one}
        onPress={() => void copy()}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedText type="small" themeColor="textSecondary" style={styles.address}>
          {copied
            ? 'Copied ✓'
            : `${shorten(address)}${chain ? ` · ${chain}` : ''}`}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  frame: {
    overflow: 'hidden',
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
  },
  address: {
    fontFamily: Fonts.mono,
  },
  pressed: {
    opacity: 0.6,
  },
});
