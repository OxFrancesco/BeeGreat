import { api } from '@beegreat/backend/convex/_generated/api';
import { useClerk } from '@clerk/clerk-expo';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { type PropsWithChildren, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChatGptAuthStatus = FunctionReturnType<typeof api.chatgptAuth.status>;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('ALREADY_CONNECTED')) {
    return 'ChatGPT is already connected.';
  }
  return 'Could not update the ChatGPT connection. Try again.';
}

function ChatGptAuthPanel({
  status,
  compact = false,
}: {
  status: ChatGptAuthStatus;
  compact?: boolean;
}) {
  const theme = useTheme();
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
  const copyAndOpen = () =>
    run(async () => {
      if (!status.userCode || !status.verificationUri) return;
      await Clipboard.setStringAsync(status.userCode);
      setCopied(true);
      await WebBrowser.openBrowserAsync(status.verificationUri, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    });

  const isPending = status.state === 'starting' || status.state === 'pending';
  const needsConnection =
    status.state === 'disconnected' ||
    status.state === 'failed' ||
    status.state === 'needs_reauth';

  return (
    <View
      style={[
        styles.panel,
        compact && styles.panelCompact,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <View style={styles.headingRow}>
        <View style={[styles.mark, { backgroundColor: theme.primary }]}>
          <ThemedText style={{ color: theme.primaryForeground }}>⌁</ThemedText>
        </View>
        <View style={styles.headingCopy}>
          <ThemedText type={compact ? 'default' : 'subtitle'}>
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
            onPress={async () => {
              await Clipboard.setStringAsync(status.userCode!);
              setCopied(true);
              Haptics.selectionAsync();
            }}
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
            onPress={copyAndOpen}
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

      {!compact ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          Experimental Codex connection. OAuth credentials are encrypted server-side and never stored in the app.
        </ThemedText>
      ) : null}
    </View>
  );
}

export function ChatGptAuthSettings() {
  const status = useQuery(api.chatgptAuth.status);
  if (!status) {
    return <ActivityIndicator />;
  }
  return <ChatGptAuthPanel status={status} compact />;
}

export function ChatGptAuthGate({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { signOut } = useClerk();
  const status = useQuery(api.chatgptAuth.status);
  if (!status) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }
  if (status.state === 'connected') return children;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <ThemedText type="title">Bee, meet ChatGPT.</ThemedText>
          <ThemedText themeColor="textSecondary">
            Connect once. BeeGreat securely refreshes your Codex session whenever it needs to.
          </ThemedText>
        </View>
        <ChatGptAuthPanel status={status} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of BeeGreat"
          onPress={() => signOut()}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <ThemedText type="small" themeColor="textSecondary">Sign out of BeeGreat</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { gap: Spacing.two },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  panelCompact: { alignSelf: 'stretch', borderRadius: 16, padding: Spacing.three },
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
  footnote: { textAlign: 'center' },
  signOut: { alignSelf: 'center', padding: Spacing.two },
  pressed: { opacity: 0.7 },
});
