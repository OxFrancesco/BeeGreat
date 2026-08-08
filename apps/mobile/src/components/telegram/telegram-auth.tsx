import { api } from '@beegreat/backend/convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { captureMobileFailure } from '@/lib/sentry';

const APP_REDIRECT_URI = 'beegreat://profile';

export function TelegramAuthSettings() {
  const theme = useTheme();
  const status = useQuery(api.telegram.status);
  const beginAuthorization = useAction(
    api.telegramAuthActions.beginAuthorization,
  );
  const disconnect = useMutation(api.telegram.disconnect);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    try {
      const { authorizationUrl } = await beginAuthorization({ client: 'mobile' });
      const result = await WebBrowser.openAuthSessionAsync(
        authorizationUrl,
        APP_REDIRECT_URI,
      );
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success') {
        throw new Error('Telegram did not finish connecting. Try again.');
      }
      const outcome = new URL(result.url).searchParams.get('telegram');
      if (outcome !== 'connected') {
        throw new Error('Telegram authorization did not complete. Try again.');
      }
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (cause) {
      captureMobileFailure(cause, 'telegram.connect');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not connect Telegram. Try again.',
      );
    } finally {
      setWorking(false);
    }
  };

  const removeConnection = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await disconnect({});
    } catch (cause) {
      captureMobileFailure(cause, 'telegram.disconnect');
      setError('Could not disconnect Telegram. Try again.');
    } finally {
      setWorking(false);
    }
  };

  if (!status) return <ActivityIndicator color={theme.primary} />;
  const connected = status.state === 'connected';
  const account =
    status.state === 'connected'
      ? status.username
        ? `@${status.username}`
        : status.displayName
      : undefined;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        connected && { borderColor: theme.primary },
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.mark, { backgroundColor: '#229ED9' }]}>
          <SymbolView
            name="paperplane.fill"
            size={21}
            tintColor="#ffffff"
            fallback={<ThemedText style={styles.fallback}>T</ThemedText>}
          />
        </View>
        <View style={styles.copy}>
          <ThemedText type="default">
            {connected ? 'Telegram connected' : 'Connect Telegram'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
            {connected
              ? `${account ?? 'Your account'} can receive messages from Bee.`
              : 'Let Bee send notes and updates directly to you.'}
          </ThemedText>
        </View>
      </View>
      {status.message || error ? (
        <ThemedText type="small" themeColor="destructive" selectable>
          {error ?? status.message}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={connected ? 'Disconnect Telegram' : 'Connect Telegram'}
        disabled={working}
        onPress={() => void (connected ? removeConnection() : connect())}
        style={({ pressed }) => [
          styles.button,
          connected
            ? { borderColor: theme.border }
            : { backgroundColor: theme.primary },
          pressed && styles.pressed,
        ]}
      >
        {working ? (
          <ActivityIndicator
            color={connected ? theme.primary : theme.primaryForeground}
          />
        ) : (
          <ThemedText
            type="smallBold"
            style={{
              color: connected ? theme.textSecondary : theme.primaryForeground,
            }}
          >
            {connected ? 'Disconnect' : 'Continue with Telegram'}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    borderCurve: 'continuous',
    gap: Spacing.three,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  mark: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  fallback: { color: '#ffffff', fontWeight: '700' },
  copy: { flex: 1, gap: Spacing.one },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
