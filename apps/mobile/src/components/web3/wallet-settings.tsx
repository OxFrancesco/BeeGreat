import { api } from '@beegreat/backend/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { WalletQrCard } from '@/components/web3/wallet-qr';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Wallets card for the profile screen (shown while the Web3 power-up is on):
 * the Bee smart wallet address (tap to copy) and the user's own linked EOA.
 * The EOA is an address-only link — BeeGreat never holds its keys; Bee uses
 * it to build unsigned DeFi plans the user signs in their own wallet app.
 */
export function WalletSettings() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const wallets = useQuery(api.wallets.myWallets);
  const linkEoa = useMutation(api.wallets.linkEoa);
  const unlinkEoa = useMutation(api.wallets.unlinkEoa);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (wallets === undefined) return null;

  const copyAddress = async (address: string) => {
    Haptics.selectionAsync();
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveEoa = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await linkEoa({ address: draft });
      setDraft('');
      setEditing(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Couldn’t link that address.',
      );
    } finally {
      setWorking(false);
    }
  };

  const removeEoa = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await unlinkEoa();
    } catch {
      setError('Couldn’t unlink the wallet. Try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText type="default">Bee smart wallet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {wallets.smartWallet
              ? `${shorten(wallets.smartWallet.address)} · ${wallets.smartWallet.supportedChains.map(formatChain).join(' · ')}`
              : 'Created the first time you ask Bee about your wallet'}
          </ThemedText>
        </View>
        {wallets.smartWallet ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showQr ? 'Hide wallet QR code' : 'Show wallet QR code'
              }
              accessibilityState={{ expanded: showQr }}
              onPress={() => {
                Haptics.selectionAsync();
                setShowQr(!showQr);
              }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <SymbolView
                name="qrcode"
                size={17}
                tintColor={showQr ? theme.primary : theme.textSecondary}
                fallback={
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    ▦
                  </ThemedText>
                }
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy smart wallet address"
              onPress={() => void copyAddress(wallets.smartWallet!.address)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                {copied ? 'Copied ✓' : 'Copy'}
              </ThemedText>
            </Pressable>
          </>
        ) : null}
      </View>

      {showQr && wallets.smartWallet ? (
        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(200)
              : ZoomIn.springify().damping(16).stiffness(220)
          }
          exiting={FadeOut.duration(140)}
          style={styles.qrWrap}
        >
          <WalletQrCard
            address={wallets.smartWallet.address}
            chain={wallets.smartWallet.supportedChains
              .map(formatChain)
              .join(' · ')}
          />
        </Animated.View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText type="default">Your own wallet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {wallets.eoa
              ? shorten(wallets.eoa.address)
              : 'Link an address so Bee can build DeFi plans you sign yourself'}
          </ThemedText>
        </View>
        {wallets.eoa ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlink your wallet"
            disabled={working}
            onPress={() => void removeEoa()}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <ThemedText type="smallBold" themeColor="destructive">
              Unlink
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Cancel linking' : 'Link a wallet'}
            onPress={() => {
              Haptics.selectionAsync();
              setEditing(!editing);
              setError(null);
            }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <ThemedText type="smallBold" themeColor="textSecondary">
              {editing ? 'Cancel' : 'Link'}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {editing && !wallets.eoa ? (
        <View style={styles.editor}>
          <TextInput
            accessibilityLabel="Wallet address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="0x…"
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            style={[
              styles.input,
              {
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: theme.background,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save wallet address"
            disabled={working || draft.trim().length === 0}
            onPress={() => void saveEoa()}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: theme.primary },
              (pressed || working) && styles.pressed,
            ]}
          >
            <ThemedText
              type="smallBold"
              style={{ color: theme.primaryForeground }}
            >
              Save
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function shorten(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatChain(chain: string) {
  return chain
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  action: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  // Springs open from the QR button's row.
  qrWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    transformOrigin: 'top center',
  },
  editor: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontFamily: Fonts.mono,
    fontSize: 13,
  },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.6,
  },
});
