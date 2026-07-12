import { api } from '@beegreat/backend/convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const APP_REDIRECT_URI = 'beegreat://profile';

export function GoogleHealthAuthSettings() {
  const theme = useTheme();
  const status = useQuery(api.googleHealthAuth.status);
  const beginAuthorization = useAction(
    api.googleHealthAuthActions.beginAuthorization,
  );
  const disconnect = useMutation(api.googleHealthAuth.disconnect);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status) return <ActivityIndicator color={theme.primary} />;

  const connect = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { authorizationUrl } = await beginAuthorization({});
      const result = await WebBrowser.openAuthSessionAsync(
        authorizationUrl,
        APP_REDIRECT_URI,
      );
      if (
        result.type !== 'success' &&
        result.type !== 'cancel' &&
        result.type !== 'dismiss'
      ) {
        setError('Google Health did not finish connecting. Try again.');
      }
    } catch {
      setError(
        'Could not connect Google Health. Check the app setup and try again.',
      );
    } finally {
      setWorking(false);
    }
  };

  const removeConnection = async () => {
    if (working) return;
    setWorking(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await disconnect({});
    } catch {
      setError('Could not disconnect Google Health. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const connected = status.state === 'connected';
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <View style={styles.copy}>
        <ThemedText type="small">
          {connected
            ? 'Google Health connected'
            : status.state === 'pending'
              ? 'Waiting for Google consent'
              : 'Connect your health data'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Read-only access. Credentials are encrypted and never stored on this
          device.
        </ThemedText>
        {status.message || error ? (
          <ThemedText type="small" themeColor="destructive">
            {error ?? status.message}
          </ThemedText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          connected ? 'Disconnect Google Health' : 'Connect Google Health'
        }
        disabled={working}
        onPress={connected ? removeConnection : connect}
        style={({ pressed }) => [
          styles.button,
          connected
            ? { borderColor: theme.destructive }
            : { backgroundColor: theme.primary, borderColor: theme.primary },
          pressed && styles.pressed,
        ]}
      >
        {working ? (
          <ActivityIndicator
            color={connected ? theme.destructive : theme.primaryForeground}
          />
        ) : (
          <ThemedText
            type="small"
            themeColor={connected ? 'destructive' : undefined}
            style={connected ? undefined : { color: theme.primaryForeground }}
          >
            {connected
              ? 'Disconnect'
              : status.state === 'pending'
                ? 'Try again'
                : 'Connect'}
          </ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  copy: {
    gap: Spacing.half,
  },
  button: {
    minHeight: 38,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
