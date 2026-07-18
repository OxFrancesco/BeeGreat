import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { type PropsWithChildren, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingBee } from "@/components/floating-bee";
import { Hive } from "@/components/hex-button";
import { Fonts, Spacing } from "@/constants/theme";
import { markPaywallSeen, usePaywallSeen } from "@/lib/preferences";

import { useSubscription } from "./subscription-provider";

type PaywallLinks = {
  termsUrl: string;
  privacyUrl: string;
};

export type SubscriptionPaywallProps = PaywallLinks & {
  /** Dismisses the paywall without subscribing; Pro stays optional. */
  onDismiss: () => void;
  dismissLabel?: string;
};

const FEATURES = [
  "Talk and plan with your personal Bee",
  "Turn ideas into clear goals",
  "Keep Mind, Hive, and progress together",
] as const;

function hapticSelection() {
  if (process.env.EXPO_OS === "ios") {
    void Haptics.selectionAsync();
  }
}

async function openLegalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Legal links must use HTTPS.");
  }
  await WebBrowser.openBrowserAsync(parsed.toString(), {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

export function SubscriptionPaywall({
  termsUrl,
  privacyUrl,
  onDismiss,
  dismissLabel = "Continue without Pro",
}: SubscriptionPaywallProps) {
  const insets = useSafeAreaInsets();
  const subscription = useSubscription();
  const { phase, recordPaywallImpression } = subscription;
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (phase === "inactive") {
      void recordPaywallImpression();
    }
  }, [phase, recordPaywallImpression]);

  const busy = subscription.operation !== null;
  const canUseStore =
    subscription.phase === "inactive" || subscription.phase === "active";
  const purchaseLabel = subscription.plan
    ? `Subscribe for ${subscription.plan.localizedPrice} / month`
    : "Monthly plan unavailable";

  const runLegalAction = (url: string) => {
    hapticSelection();
    setLocalError(null);
    void openLegalUrl(url).catch(() => {
      setLocalError("Couldn't open that page. Please try again.");
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(insets.top, Spacing.four),
          paddingBottom: Math.max(insets.bottom, Spacing.four),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        accessible
        accessibilityLabel="BeeGreat live paywall ready"
        pointerEvents="none"
        style={styles.captureHandshake}
      />
      <View style={styles.content}>
        <View style={styles.hero}>
          <FloatingBee height={96} />
          <Text selectable style={styles.title}>
            BeeGreat Pro
          </Text>
          <View style={styles.featureList}>
            {FEATURES.map((feature) => (
              <Text key={feature} selectable style={styles.featureLabel}>
                {feature}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.rule} />

        <Text selectable style={styles.priceLine}>
          Monthly subscription
          {subscription.plan
            ? ` · ${subscription.plan.localizedPrice} / month`
            : ""}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={purchaseLabel}
          accessibilityState={{
            busy: subscription.operation === "purchase",
            disabled: !canUseStore || !subscription.plan || busy,
          }}
          disabled={!canUseStore || !subscription.plan || busy}
          onPress={() => {
            hapticSelection();
            setLocalError(null);
            subscription.clearFeedback();
            void subscription.purchase();
          }}
          style={({ pressed }) => [
            styles.subscribe,
            (!canUseStore || !subscription.plan || busy) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {subscription.operation === "purchase" ? (
            <ActivityIndicator color={Hive.cream} />
          ) : (
            <Text style={styles.subscribeLabel}>{purchaseLabel}</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={() => {
            hapticSelection();
            onDismiss();
          }}
          style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
        >
          <Text style={styles.dismissLabel}>{dismissLabel}</Text>
        </Pressable>

        {subscription.phase === "unavailable" || !subscription.plan ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try Again"
            accessibilityState={{
              busy: subscription.operation === "refresh",
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => {
              hapticSelection();
              setLocalError(null);
              void subscription.refresh();
            }}
            style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
          >
            {subscription.operation === "refresh" ? (
              <ActivityIndicator color={Hive.cacao} />
            ) : (
              <Text style={styles.linkLabel}>Try Again</Text>
            )}
          </Pressable>
        ) : null}

        {subscription.error || localError ? (
          <Text selectable accessibilityRole="alert" style={styles.error}>
            {localError ?? subscription.error}
          </Text>
        ) : null}
        {subscription.message ? (
          <Text selectable accessibilityRole="alert" style={styles.message}>
            {subscription.message}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <Text selectable style={styles.renewalCopy}>
            Charged to your Apple Account at confirmation. Renews automatically
            every month unless canceled at least 24 hours before the period
            ends. Manage or cancel anytime in App Store settings.
          </Text>
          <View style={styles.legalRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Restore Purchases"
              accessibilityState={{
                busy: subscription.operation === "restore",
                disabled: !canUseStore || busy,
              }}
              disabled={!canUseStore || busy}
              onPress={() => {
                hapticSelection();
                setLocalError(null);
                subscription.clearFeedback();
                void subscription.restore();
              }}
              style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
            >
              {subscription.operation === "restore" ? (
                <ActivityIndicator size="small" color={Hive.cacao} />
              ) : (
                <Text style={styles.legalLinkLabel}>Restore Purchases</Text>
              )}
            </Pressable>
            <Text style={styles.legalSeparator}>•</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open BeeGreat Terms of Use"
              onPress={() => runLegalAction(termsUrl)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
            >
              <Text style={styles.legalLinkLabel}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.legalSeparator}>•</Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Open BeeGreat Privacy Policy"
              onPress={() => runLegalAction(privacyUrl)}
              style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
            >
              <Text style={styles.legalLinkLabel}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Shows the paywall exactly once on first launch; afterwards the app opens
 * directly and upgrading lives in the profile sheet.
 */
export function SubscriptionGate({
  children,
  ...paywallLinks
}: PropsWithChildren<PaywallLinks>) {
  const subscription = useSubscription();
  const paywallSeen = usePaywallSeen();

  if (subscription.phase === "active" || paywallSeen) return children;

  if (
    subscription.phase === "loading" ||
    subscription.phase === "waiting-for-user"
  ) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={Hive.cacao} />
        <Text selectable style={styles.loadingLabel}>
          Checking BeeGreat Pro…
        </Text>
      </View>
    );
  }

  return <SubscriptionPaywall {...paywallLinks} onDismiss={markPaywallSeen} />;
}

const styles = StyleSheet.create({
  captureHandshake: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0.01,
    top: 0,
    left: 0,
  },
  screen: {
    flex: 1,
    backgroundColor: Hive.cream,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.five,
  },
  content: {
    width: "100%",
    maxWidth: 480,
    alignItems: "center",
    gap: Spacing.three,
  },
  hero: {
    alignItems: "center",
    gap: Spacing.three,
  },
  title: {
    fontFamily: Fonts?.rounded,
    color: Hive.cacao,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.7,
    textAlign: "center",
  },
  featureList: {
    alignItems: "center",
    gap: Spacing.one,
  },
  featureLabel: {
    fontFamily: Fonts?.sans,
    color: Hive.bark,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  rule: {
    width: 48,
    height: 2,
    borderRadius: 1,
    backgroundColor: Hive.honey,
  },
  priceLine: {
    fontFamily: Fonts?.rounded,
    color: Hive.cacao,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  subscribe: {
    alignSelf: "stretch",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: Hive.cacao,
  },
  subscribeLabel: {
    fontFamily: Fonts?.rounded,
    color: Hive.cream,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  textAction: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  dismissLabel: {
    fontFamily: Fonts?.rounded,
    color: Hive.bark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  linkLabel: {
    fontFamily: Fonts?.sans,
    color: Hive.cacao,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  error: {
    fontFamily: Fonts?.sans,
    color: Hive.destructive,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  message: {
    fontFamily: Fonts?.sans,
    color: Hive.bark,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  renewalCopy: {
    fontFamily: Fonts?.sans,
    color: Hive.bark,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    opacity: 0.75,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  legalLink: {
    minHeight: 32,
    justifyContent: "center",
  },
  legalLinkLabel: {
    fontFamily: Fonts?.sans,
    color: Hive.cacao,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  legalSeparator: {
    color: Hive.bark,
    opacity: 0.6,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    padding: Spacing.four,
    backgroundColor: Hive.cream,
  },
  loadingLabel: {
    fontFamily: Fonts?.rounded,
    color: Hive.cacao,
    fontSize: 15,
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.7,
  },
});
