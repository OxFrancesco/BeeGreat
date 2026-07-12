import { api } from '@beegreat/backend/convex/_generated/api';
import { useClerk } from '@clerk/clerk-expo';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { type PropsWithChildren, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingBee } from '@/components/floating-bee';
import { HexButton, Hive } from '@/components/hex-button';
import { ThemedText } from '@/components/themed-text';
import { MotionDuration } from '@/constants/motion';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatGptAuthStatus = FunctionReturnType<typeof api.chatgptAuth.status>;

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

  return { working, copied, error, connect, removeConnection, copyCode, copyAndOpen };
}

/** Compact themed panel for the settings screen. */
function ChatGptAuthPanel({ status }: { status: ChatGptAuthStatus }) {
  const theme = useTheme();
  const { working, copied, error, connect, removeConnection, copyCode, copyAndOpen } =
    useChatGptAuthActions();

  const isPending = status.state === 'starting' || status.state === 'pending';
  const needsConnection =
    status.state === 'disconnected' ||
    status.state === 'failed' ||
    status.state === 'needs_reauth';

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headingRow}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <ThemedText style={{ color: theme.primaryForeground }}>⌁</ThemedText>
        </View>
        <View style={styles.headingCopy}>
          <ThemedText>
            {status.state === 'connected' ? 'ChatGPT connected' : 'Connect ChatGPT'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Use your ChatGPT plan through the Codex provider.
          </ThemedText>
        </View>
      </View>

      {status.state === 'connected' ? (
        <View style={styles.connectedRow}>
          <View style={[styles.statusDot, { backgroundColor: '#46a758' }]} />
          <ThemedText type="small">Durable connection active</ThemedText>
        </View>
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
  const { working, copied, error, connect, removeConnection, copyAndOpen } =
    useChatGptAuthActions();

  if (!status) {
    return (
      <View style={[gate.screen, gate.loading]}>
        <ActivityIndicator color={Hive.cacao} />
      </View>
    );
  }
  if (status.state === 'connected') return children;

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
          <Text style={gate.tagline}>
            Connect once. BeeGreat securely refreshes{'\n'}your Codex session whenever it needs to.
          </Text>

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
          <Text style={gate.legal}>
            Experimental Codex connection. OAuth credentials are encrypted server-side and never
            stored in the app.
          </Text>
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
  legal: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: Hive.bark,
    opacity: 0.7,
    paddingHorizontal: Spacing.four,
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
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headingCopy: { flex: 1, gap: Spacing.half },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
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
