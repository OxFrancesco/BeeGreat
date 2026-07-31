import { api } from '@beegreat/backend/convex/_generated/api';
import {
  Canvas,
  Group,
  Path,
  Rect,
  RoundedRect,
  Skia,
} from '@shopify/react-native-skia';
import { useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import createQr from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Easing,
  interpolate,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HONEY = '#FAB52A';
const INK = '#43230F';
const PAPER = '#FFF9EC';

/** The Bee smart wallet address, or null while loading / before creation. */
export function useSmartWalletAddress() {
  const wallets = useQuery(api.wallets.myWallets);
  return wallets?.smartWallet?.address ?? null;
}

const QUIET_MODULES = 2;

/** All dark QR modules as one Skia path of softly rounded cells. */
function buildQrPath(data: string, size: number) {
  const qr = createQr(0, 'M');
  qr.addData(data);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / (count + QUIET_MODULES * 2);
  const radius = cell * 0.32;
  const path = Skia.Path.Make();
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      const x = (col + QUIET_MODULES) * cell;
      const y = (row + QUIET_MODULES) * cell;
      // Cells overlap by a hair so adjacent modules fuse without seams.
      path.addRRect(
        Skia.RRectXY(
          Skia.XYWHRect(x, y, cell * 1.04, cell * 1.04),
          radius,
          radius,
        ),
      );
    }
  }
  return path;
}

/**
 * Wallet address QR with a honey scan-line reveal: the code sweeps in from
 * the top behind a moving amber line, then settles. Reduced motion renders
 * the finished code immediately.
 */
export function WalletQrCode({ address, size }: { address: string; size: number }) {
  const reducedMotion = useReducedMotion();
  const path = useMemo(() => buildQrPath(address, size), [address, size]);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      140,
      withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) }),
    );
  }, [address, progress, reducedMotion]);

  const revealClip = useDerivedValue(() => ({
    x: 0,
    y: 0,
    width: size,
    height: size * progress.value,
  }));
  const scanY = useDerivedValue(() =>
    Math.min(size - 2, size * progress.value),
  );
  const scanOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 0.05, 0.92, 1], [0, 0.9, 0.9, 0]),
  );

  return (
    <Canvas style={{ width: size, height: size }}>
      <RoundedRect x={0} y={0} width={size} height={size} r={Spacing.two} color={PAPER} />
      <Group clip={revealClip}>
        <Path path={path} color={INK} />
      </Group>
      <Rect x={0} y={scanY} width={size} height={2} color={HONEY} opacity={scanOpacity} />
    </Canvas>
  );
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
