import { api } from '@beegreat/backend/convex/_generated/api';
import { useClerk } from '@clerk/clerk-expo';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { type PropsWithChildren, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingBee } from '@/components/floating-bee';
import { HexButton, Hive } from '@/components/hex-button';
import { InfoButton } from '@/components/info-button';
import { ThemedText } from '@/components/themed-text';
import { MotionDuration } from '@/constants/motion';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatGptAuthStatus = FunctionReturnType<typeof api.chatgptAuth.status>;

const CHATGPT_LOGO_PATH =
  'M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z';

/** OpenAI ChatGPT logomark rendered via expo-image so we skip react-native-svg. */
function ChatGptLogo({ size, color }: { size: number; color: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="260" viewBox="0 0 256 260"><path fill="${color}" d="${CHATGPT_LOGO_PATH}"/></svg>`;
  return (
    <Image
      source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }}
      style={{ width: size, height: (size * 260) / 256 }}
      contentFit="contain"
    />
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('ALREADY_CONNECTED')) {
    return 'ChatGPT is already connected.';
  }
  return 'Could not update the ChatGPT connection. Try again.';
}

/** Shared connect/disconnect/copy actions for the gate and settings surfaces. */
function useChatGptAuthActions() {
  const start = useMutation(api.chatgptAuth.start);
  const disconnect = useMutation(api.chatgptAuth.disconnect);
  const skip = useMutation(api.chatgptAuth.skip);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (operation: () => Promise<unknown>) => {
    if (working) return;
    setWorking(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await operation();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(false);
    }
  };

  const connect = () => run(() => start({}));
  const removeConnection = () => run(() => disconnect({}));
  const skipConnection = () => run(() => skip({}));
  const copyCode = async (userCode: string) => {
    await Clipboard.setStringAsync(userCode);
    setCopied(true);
    Haptics.selectionAsync();
  };
  const copyAndOpen = (status: ChatGptAuthStatus) =>
    run(async () => {
      if (!status.userCode || !status.verificationUri) return;
      await Clipboard.setStringAsync(status.userCode);
      setCopied(true);
      await WebBrowser.openBrowserAsync(status.verificationUri, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    });

  return { working, copied, error, connect, removeConnection, skipConnection, copyCode, copyAndOpen };
}

/** Compact themed panel for the settings screen. */
function ChatGptAuthPanel({ status }: { status: ChatGptAuthStatus }) {
  const theme = useTheme();
  const { working, copied, error, connect, removeConnection, copyCode, copyAndOpen } =
    useChatGptAuthActions();
  const [showInfo, setShowInfo] = useState(false);

  const isPending = status.state === 'starting' || status.state === 'pending';
  const needsConnection =
    status.state === 'disconnected' ||
    status.state === 'failed' ||
    status.state === 'needs_reauth';

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.card, borderColor: theme.border },
        status.state === 'connected' && styles.panelActive,
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <ChatGptLogo size={24} color={theme.primaryForeground} />
        </View>
        <View style={styles.headingTitleRow}>
          <ThemedText>
            {status.state === 'connected' ? 'ChatGPT connected' : 'Connect ChatGPT'}
          </ThemedText>
          <InfoButton
            active={showInfo}
            label="About the ChatGPT connection"
            onPress={() => setShowInfo((visible) => !visible)}
          />
        </View>
      </View>
      {showInfo ? (
        <ThemedText type="small" themeColor="textSecondary">
          Your Bee thinks with your ChatGPT plan through Codex. Without it, BeeGreat&apos;s built-in
          model answers instead.
        </ThemedText>
      ) : null}

      {status.state === 'starting' ? (
        <View style={styles.progressRow}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small">Creating a secure device code…</ThemedText>
        </View>
      ) : null}

      {status.state === 'pending' && status.userCode ? (
        <View style={styles.codeSection}>
          <ThemedText type="small" themeColor="textSecondary">
            Your one-time code
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy ChatGPT device code"
            onPress={() => copyCode(status.userCode!)}
            style={({ pressed }) => [
              styles.codeBox,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="code" style={styles.code} selectable>
              {status.userCode}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {copied ? 'Copied' : 'Tap to copy'}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            Open ChatGPT, paste this code, and return here. BeeGreat will finish automatically.
          </ThemedText>
        </View>
      ) : null}

      {status.message ? (
        <ThemedText type="small" themeColor="destructive">
          {status.message}
        </ThemedText>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        {needsConnection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Connect ChatGPT"
            disabled={working}
            onPress={connect}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            {working ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground }}>Connect ChatGPT</ThemedText>
            )}
          </Pressable>
        ) : null}
        {status.state === 'pending' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open ChatGPT authentication"
            disabled={working}
            onPress={() => copyAndOpen(status)}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            {working ? (
              <ActivityIndicator color={theme.primaryForeground} />
            ) : (
              <ThemedText style={{ color: theme.primaryForeground }}>Copy code and open ChatGPT</ThemedText>
            )}
          </Pressable>
        ) : null}
        {isPending || status.state === 'connected' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPending ? 'Cancel ChatGPT connection' : 'Disconnect ChatGPT'}
            disabled={working}
            onPress={removeConnection}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: status.state === 'connected' ? theme.destructive : theme.border },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              type="small"
              themeColor={status.state === 'connected' ? 'destructive' : 'textSecondary'}
            >
              {isPending ? 'Cancel' : 'Disconnect'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ChatGptAuthSettings() {
  const status = useQuery(api.chatgptAuth.status);
  if (!status) {
    return <ActivityIndicator />;
  }
  return <ChatGptAuthPanel status={status} />;
}

/**
 * Full-screen gate styled to match the sign-in scene: cream hive backdrop,
 * the floating bee, rounded cacao display type, and the honeycomb button.
 */
export function ChatGptAuthGate({ children }: PropsWithChildren) {
  const { signOut } = useClerk();
  const status = useQuery(api.chatgptAuth.status);
  const reducedMotion = useReducedMotion();
  const { working, copied, error, connect, removeConnection, skipConnection, copyAndOpen } =
    useChatGptAuthActions();

  if (!status) {
    return (
      <View style={[gate.screen, gate.loading]}>
        <ActivityIndicator color={Hive.cacao} />
      </View>
    );
  }
  // Connecting ChatGPT is optional: skipped users run on the default
  // OpenRouter model and can connect later from settings.
  if (status.state === 'connected' || status.skipped) return children;

  const isPending = status.state === 'pending' && !!status.userCode;
  const isStarting = status.state === 'starting';

  return (
    <View style={gate.screen}>
      <SafeAreaView style={gate.safeArea}>
        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeInDown.springify().damping(16)
          }
          style={gate.copy}
        >
          <FloatingBee style={gate.bee} />
          <Text style={gate.title}>Bee, meet ChatGPT.</Text>
          <Text style={gate.tagline}>Connect your ChatGPT account to your bee!</Text>

          {isStarting ? (
            <View style={gate.progressRow}>
              <ActivityIndicator color={Hive.cacao} />
              <Text style={gate.progressLabel}>Creating a secure device code…</Text>
            </View>
          ) : null}

          {isPending ? (
            <View style={gate.codeCell}>
              <Text style={gate.codeLabel}>Your one-time code</Text>
              <Text style={gate.code} selectable>
                {status.userCode}
              </Text>
              <Text style={gate.codeHint}>
                {copied
                  ? 'Copied. Paste it in ChatGPT and return here.'
                  : 'Paste it in ChatGPT and return here.'}
              </Text>
            </View>
          ) : null}

          {status.message ? <Text style={gate.error}>{status.message}</Text> : null}
          {error ? <Text style={gate.error}>{error}</Text> : null}
        </Animated.View>

        <Animated.View
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeIn.delay(350).duration(500)
          }
          style={gate.actions}
        >
          {isPending ? (
            <HexButton
              label="Copy code and open ChatGPT"
              busy={working}
              onPress={() => copyAndOpen(status)}
            />
          ) : (
            <HexButton
              label="Connect ChatGPT"
              busy={working || isStarting}
              onPress={connect}
            />
          )}
          {isPending || isStarting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel ChatGPT connection"
              disabled={working}
              onPress={removeConnection}
              style={({ pressed }) => [gate.textButton, pressed && styles.pressed]}
            >
              <Text style={gate.textButtonLabel}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip connecting ChatGPT"
            disabled={working}
            onPress={skipConnection}
            style={({ pressed }) => [gate.textButton, pressed && styles.pressed]}
          >
            <Text style={gate.textButtonLabel}>Skip for now</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of BeeGreat"
            onPress={() => signOut()}
            style={({ pressed }) => [gate.textButton, pressed && styles.pressed]}
          >
            <Text style={gate.textButtonLabel}>Sign out of BeeGreat</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/** Gate styles mirror app/sign-in.tsx so both entry screens read as one scene. */
const gate = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Hive.cream,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loading: { alignItems: 'center' },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.four,
  },
  copy: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  bee: {
    marginBottom: Spacing.three,
  },
  title: {
    fontFamily: Fonts?.rounded,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: Hive.cacao,
  },
  tagline: {
    fontFamily: Fonts?.sans,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: Hive.bark,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  progressLabel: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    color: Hive.bark,
  },
  codeCell: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: Hive.honey,
    backgroundColor: Hive.comb,
  },
  codeLabel: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: Hive.bark,
  },
  code: {
    fontFamily: Fonts?.mono,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 2.5,
    color: Hive.cacao,
  },
  codeHint: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    textAlign: 'center',
    color: Hive.bark,
  },
  error: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    textAlign: 'center',
    color: Hive.destructive,
    marginTop: Spacing.two,
  },
  actions: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  textButton: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  textButtonLabel: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    color: Hive.bark,
  },
});

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  panelActive: {
    borderWidth: 1.5,
    borderColor: Hive.honey,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headingTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  codeSection: { gap: Spacing.two },
  codeBox: {
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  code: { fontSize: 23, letterSpacing: 2.5 },
  actions: { gap: Spacing.two },
  primaryButton: {
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.7 },
});
