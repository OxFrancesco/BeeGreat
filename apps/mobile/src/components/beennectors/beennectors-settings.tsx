import { api } from '@beegreat/backend/convex/_generated/api';
import { useAction, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { InfoButton } from '@/components/info-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { captureMobileFailure } from '@/lib/sentry';

type BeennectorProvider = 'github' | 'linear' | 'notion';

const APP_REDIRECT_URI = 'beegreat://profile';
const MARKS: Record<BeennectorProvider, string> = {
  github: '⌘',
  linear: '◩',
  notion: 'N',
};
const BRAND_COLORS: Record<BeennectorProvider, string> = {
  github: '#24292F',
  linear: '#5E6AD2',
  notion: '#FFFFFF',
};

export function BeennectorsSettings() {
  const theme = useTheme();
  const connections = useQuery(api.beennectors.list);
  const beginAuthorization = useAction(
    api.beennectorAuthActions.beginAuthorization,
  );
  const disconnect = useAction(api.beennectorAuthActions.disconnect);
  const [working, setWorking] = useState<BeennectorProvider | null>(null);
  const [openInfo, setOpenInfo] = useState<BeennectorProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async (provider: BeennectorProvider) => {
    const { authorizationUrl } = await beginAuthorization({ provider });
    const result = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      APP_REDIRECT_URI,
    );
    if (result.type === 'cancel' || result.type === 'dismiss') return false;
    if (result.type !== 'success') {
      throw new Error(`${provider} did not finish connecting. Try again.`);
    }
    const callback = new URL(result.url);
    if (
      callback.searchParams.get('beennector') !== provider ||
      callback.searchParams.get('status') !== 'connected'
    ) {
      throw new Error(`${provider} authorization did not complete. Try again.`);
    }
    return true;
  };

  const toggle = async (provider: BeennectorProvider, connected: boolean) => {
    if (working) return;
    setWorking(provider);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (connected) await disconnect({ provider });
      else await connect(provider);
    } catch (cause) {
      captureMobileFailure(cause, 'beennector.connection', { provider });
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not update the ${provider} Beennector.`,
      );
    } finally {
      setWorking(null);
    }
  };

  if (!connections) return <ActivityIndicator color={theme.primary} />;

  return (
    <View style={styles.stack}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        Bring your work into the Hive. Beennectors are secure connections, not
        Power-ups, and Bee uses them only when they help with your request.
      </ThemedText>
      {connections.map((connection) => {
        const connected = connection.state === 'connected';
        const pending = connection.state === 'pending';
        const detail =
          connection.workspaceName ??
          connection.accountName ??
          connection.description;
        const markTextColor =
          connection.provider === 'notion' ? '#202020' : '#FFFFFF';
        return (
          <View
            key={connection.provider}
            style={[
              styles.card,
              { backgroundColor: theme.card, borderColor: theme.border },
              connected && { borderColor: theme.primary },
            ]}
          >
            <View style={styles.heading}>
              <View
                style={[
                  styles.mark,
                  { backgroundColor: BRAND_COLORS[connection.provider] },
                  connection.provider === 'notion' && styles.notionMark,
                ]}
              >
                <ThemedText style={{ color: markTextColor, fontWeight: '800' }}>
                  {MARKS[connection.provider]}
                </ThemedText>
              </View>
              <View style={styles.title}>
                <View style={styles.titleLine}>
                  <ThemedText style={styles.name}>
                    {connected
                      ? `${connection.name} connected`
                      : `Connect ${connection.name}`}
                  </ThemedText>
                  <InfoButton
                    active={openInfo === connection.provider}
                    label={`About the ${connection.name} Beennector`}
                    onPress={() =>
                      setOpenInfo(
                        openInfo === connection.provider
                          ? null
                          : connection.provider,
                      )
                    }
                  />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {detail}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.status,
                  {
                    backgroundColor: connected
                      ? theme.secondary
                      : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText type="small" style={styles.statusText}>
                  {connected ? 'Linked' : pending ? 'Waiting' : 'Off'}
                </ThemedText>
              </View>
            </View>

            {openInfo === connection.provider ? (
              <ThemedText type="small" themeColor="textSecondary">
                {connection.description} Credentials stay encrypted; Bee receives
                only the results of approved Beennector operations.
              </ThemedText>
            ) : null}
            {connection.message ? (
              <ThemedText type="small" themeColor="destructive">
                {connection.message}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                connected
                  ? `Disconnect ${connection.name}`
                  : `Connect ${connection.name}`
              }
              disabled={Boolean(working) || pending}
              onPress={() => void toggle(connection.provider, connected)}
              style={({ pressed }) => [
                styles.button,
                connected
                  ? { borderColor: theme.destructive }
                  : { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              {working === connection.provider ? (
                <ActivityIndicator
                  color={connected ? theme.destructive : theme.primaryForeground}
                />
              ) : (
                <ThemedText
                  type="small"
                  style={
                    connected
                      ? { color: theme.destructive }
                      : { color: theme.primaryForeground }
                  }
                >
                  {connected
                    ? `Disconnect ${connection.name}`
                    : pending
                      ? `Waiting for ${connection.name}…`
                      : `Connect ${connection.name}`}
                </ThemedText>
              )}
            </Pressable>
          </View>
        );
      })}
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
  },
  intro: {
    paddingHorizontal: Spacing.one,
    lineHeight: 19,
  },
  card: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notionMark: {
    borderWidth: 1,
    borderColor: '#202020',
  },
  title: {
    flex: 1,
    gap: Spacing.half,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    fontWeight: '600',
  },
  status: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  button: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});

