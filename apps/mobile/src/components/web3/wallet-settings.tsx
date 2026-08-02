import { api } from '@beegreat/backend/convex/_generated/api';
import { sameEvmAddress, signWalletLink } from '@beegreat/wallet-connect';
import { useMutation, useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
  ZoomIn,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { WalletQrCard } from '@/components/web3/wallet-qr';
import { Spacing } from '@/constants/theme';
import { useEoaWallet } from '@/hooks/use-eoa-wallet';
import { useTheme } from '@/hooks/use-theme';

/** Wallet settings for Bee's smart wallet and a verified WalletConnect EOA. */
export function WalletSettings() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const wallets = useQuery(api.wallets.myWallets);
  const beginEoaLink = useMutation(api.wallets.beginEoaLink);
  const linkEoa = useMutation(api.wallets.linkEoa);
  const unlinkEoa = useMutation(api.wallets.unlinkEoa);
  const connectedWallet = useEoaWallet();
  const yoloPrefs = useQuery(api.web3Prefs.get);
  const setYolo = useMutation(api.web3Prefs.setYolo);
  const [linkRequested, setLinkRequested] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [yoloWorking, setYoloWorking] = useState(false);
  const [yoloError, setYoloError] = useState<string | null>(null);
  const linking = useRef(false);

  const linkedAddress = wallets?.eoa?.address;
  const sessionMatches = Boolean(
    linkedAddress &&
    connectedWallet.address &&
    sameEvmAddress(linkedAddress, connectedWallet.address),
  );

  useEffect(() => {
    if (
      !linkRequested ||
      linking.current ||
      !connectedWallet.address ||
      !connectedWallet.provider
    ) {
      return;
    }
    linking.current = true;
    setWorking(true);
    setError(null);
    void (async () => {
      try {
        const challenge = await beginEoaLink({
          address: connectedWallet.address!,
        });
        const signature = await signWalletLink(
          connectedWallet.provider!,
          connectedWallet.address!,
          challenge.message,
        );
        await linkEoa({
          challengeId: challenge.challengeId,
          signature,
        });
        if (process.env.EXPO_OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setLinkRequested(false);
      } catch (cause) {
        setError(walletError(cause, 'Couldn’t link that wallet.'));
        setLinkRequested(false);
      } finally {
        linking.current = false;
        setWorking(false);
      }
    })();
  }, [
    beginEoaLink,
    connectedWallet.address,
    connectedWallet.provider,
    linkEoa,
    linkRequested,
  ]);

  if (wallets === undefined) return null;

  const toggleYolo = async (enabled: boolean) => {
    if (yoloWorking) return;
    setYoloWorking(true);
    setYoloError(null);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await setYolo({ enabled });
    } catch (cause) {
      setYoloError(walletError(cause, 'Couldn’t update YOLO mode.'));
    } finally {
      setYoloWorking(false);
    }
  };

  const copyAddress = async (address: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startLink = async () => {
    if (working) return;
    setError(null);
    setLinkRequested(true);
    if (connectedWallet.address && connectedWallet.provider) return;
    setWorking(true);
    try {
      await connectedWallet.connect();
    } catch (cause) {
      setLinkRequested(false);
      setError(walletError(cause, 'Couldn’t open WalletConnect.'));
    } finally {
      setWorking(false);
    }
  };

  const reconnect = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      if (connectedWallet.isConnected) await connectedWallet.disconnect();
      await connectedWallet.connect();
    } catch (cause) {
      setError(walletError(cause, 'Couldn’t reconnect that wallet.'));
    } finally {
      setWorking(false);
    }
  };

  const removeEoa = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await unlinkEoa();
      if (connectedWallet.isConnected) await connectedWallet.disconnect();
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
                if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
                setShowQr(!showQr);
              }}
              style={({ pressed }) => [
                styles.action,
                pressed && styles.pressed,
              ]}
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
              style={({ pressed }) => [
                styles.action,
                pressed && styles.pressed,
              ]}
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
          <ThemedText type="default">Your wallet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {wallets.eoa
              ? `${shorten(wallets.eoa.address)} · ${sessionMatches ? 'Ready to sign' : 'Reconnect to sign'}`
              : 'Link with WalletConnect so Bee can prepare transactions for you to sign'}
          </ThemedText>
        </View>
        {wallets.eoa ? (
          sessionMatches ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Unlink your wallet"
              disabled={working}
              onPress={() => void removeEoa()}
              style={({ pressed }) => [
                styles.action,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold" themeColor="destructive">
                Unlink
              </ThemedText>
            </Pressable>
          ) : (
            <PrimaryAction
              disabled={working}
              label={working ? 'Opening…' : 'Reconnect'}
              onPress={() => void reconnect()}
            />
          )
        ) : (
          <PrimaryAction
            disabled={working}
            label={working || linkRequested ? 'Linking…' : 'Link my wallet'}
            onPress={() => void startLink()}
          />
        )}
      </View>

      {error ? (
        <ThemedText
          selectable
          type="small"
          themeColor="destructive"
          accessibilityLiveRegion="polite"
        >
          {error}
        </ThemedText>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.row}>
        <View style={styles.copy}>
          <ThemedText type="default">YOLO mode</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {yoloPrefs?.yoloEnabled
              ? 'Bee auto-approves Bee smart-wallet transactions only'
              : 'Bee asks before every transaction'}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="YOLO mode: auto-approve Bee smart-wallet transactions"
          disabled={yoloWorking || yoloPrefs === undefined}
          value={yoloPrefs?.yoloEnabled ?? false}
          onValueChange={(enabled) => void toggleYolo(enabled)}
          trackColor={{ true: theme.primary }}
        />
      </View>

      {yoloError ? (
        <ThemedText selectable type="small" themeColor="destructive">
          {yoloError}
        </ThemedText>
      ) : null}
    </View>
  );
}

function PrimaryAction({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace('…', '')}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        { backgroundColor: disabled ? theme.backgroundElement : theme.primary },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        type="smallBold"
        style={{
          color: disabled ? theme.textSecondary : theme.primaryForeground,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function walletError(cause: unknown, fallback: string) {
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  return fallback;
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  primaryAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
    transformOrigin: 'top center',
  },
  pressed: {
    opacity: 0.6,
  },
});
