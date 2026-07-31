import { api } from "@beegreat/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useScreenshotFixture } from "@/lib/screenshot-fixture";

type CurrencyValues = {
  honeyBalance: number;
  honeycombScore: number;
  royalJellyBalance: number;
};

/**
 * Gacha-style currency readout: Honey, Honeycomb Score, and Royal Jelly as
 * compact capsule pills. Renders nothing until the Hive summary arrives, so
 * headers never jump between a spinner and the pills.
 */
export function CurrencyBar({
  size = "compact",
  onWalletQr,
  walletQrOpen = false,
}: {
  size?: "compact" | "regular";
  onWalletQr?: () => void;
  walletQrOpen?: boolean;
}) {
  const fixture = useScreenshotFixture();
  if (fixture) {
    return <CurrencyBarView values={fixture.hive.hive} size={size} />;
  }

  return (
    <LiveCurrencyBar size={size} onWalletQr={onWalletQr} walletQrOpen={walletQrOpen} />
  );
}

function LiveCurrencyBar({
  size,
  onWalletQr,
  walletQrOpen,
}: {
  size: "compact" | "regular";
  onWalletQr?: () => void;
  walletQrOpen?: boolean;
}) {
  const current = useQuery(api.firstFocus.getCurrent, {});
  if (!current) return null;

  return (
    <CurrencyBarView
      values={current.hive}
      size={size}
      onWalletQr={onWalletQr}
      walletQrOpen={walletQrOpen}
    />
  );
}

export function CurrencyBarView({
  values,
  size = "compact",
  onWalletQr,
  walletQrOpen = false,
}: {
  values: CurrencyValues;
  size?: "compact" | "regular";
  onWalletQr?: () => void;
  walletQrOpen?: boolean;
}) {
  const theme = useTheme();

  const regular = size === "regular";
  const currencies = [
    {
      label: "Honey",
      icon: "drop.fill" as const,
      tint: "#E19100",
      value: values.honeyBalance,
    },
    {
      label: "Honeycomb Score",
      icon: "hexagon.fill" as const,
      tint: "#D78A00",
      value: values.honeycombScore,
    },
    {
      label: "Royal Jelly",
      icon: "crown.fill" as const,
      tint: "#C85682",
      value: values.royalJellyBalance,
    },
  ];

  return (
    <View style={styles.bar}>
      {currencies.map((currency) => (
        <View
          key={currency.label}
          accessible
          accessibilityLabel={`${currency.label} ${currency.value}`}
          style={[
            styles.pill,
            regular && styles.pillRegular,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <SymbolView
            name={currency.icon}
            size={regular ? 15 : 13}
            tintColor={currency.tint}
            fallback={null}
          />
          <ThemedText
            type={regular ? "smallBold" : "small"}
            style={styles.value}
            selectable
          >
            {formatCount(currency.value)}
          </ThemedText>
        </View>
      ))}
      {onWalletQr ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show wallet QR code"
          accessibilityState={{ expanded: walletQrOpen }}
          hitSlop={Spacing.two}
          onPress={onWalletQr}
          style={({ pressed }) => [
            styles.pill,
            regular && styles.pillRegular,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.qrPressed,
          ]}
        >
          <SymbolView
            name="qrcode"
            size={regular ? 15 : 13}
            tintColor={walletQrOpen ? theme.primary : theme.textSecondary}
            fallback={
              <ThemedText type={regular ? "smallBold" : "small"} themeColor="textSecondary">
                ▦
              </ThemedText>
            }
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pillRegular: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  value: {
    fontVariant: ["tabular-nums"],
  },
  qrPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});
