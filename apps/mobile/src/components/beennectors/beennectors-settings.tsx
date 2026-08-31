import { api } from '@beegreat/backend/convex/_generated/api';
import {
  GOOGLE_WORKSPACE_DISCLOSURE,
  GOOGLE_WORKSPACE_DISCLOSURE_VERSION,
  GOOGLE_WORKSPACE_SERVICES,
  type GoogleWorkspaceService,
} from '@beegreat/tool-presentation';
import { useAction, useQuery } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  GitHubLogo,
  GoogleLogo,
  LinearLogo,
  NotionLogo,
} from '@/components/beennectors/beennector-logos';
import { InfoButton } from '@/components/info-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { captureMobileFailure } from '@/lib/sentry';

type BeennectorProvider = 'github' | 'linear' | 'notion' | 'google';

const APP_REDIRECT_URI = 'beegreat://profile';
const MARKS = {
  github: <GitHubLogo size={22} />,
  linear: <LinearLogo size={20} />,
  notion: <NotionLogo size={20} />,
  google: <GoogleLogo size={22} />,
} satisfies Record<BeennectorProvider, ReactNode>;
const BRAND_COLORS = {
  github: '#24292F',
  linear: '#5E6AD2',
  notion: '#FFFFFF',
  google: '#FFFFFF',
} satisfies Record<BeennectorProvider, string>;
const PROVIDER_NAMES = {
  github: 'GitHub',
  linear: 'Linear',
  notion: 'Notion',
  google: 'Google Workspace',
} satisfies Record<BeennectorProvider, string>;

export function BeennectorsSettings() {
  const theme = useTheme();
  const connections = useQuery(api.beennectors.list);
  const beginAuthorization = useAction(
    api.beennectorAuthActions.beginAuthorization,
  );
  const disconnect = useAction(api.beennectorAuthActions.disconnect);
  const [working, setWorking] = useState<BeennectorProvider | null>(null);
  const [openInfo, setOpenInfo] = useState<BeennectorProvider | null>(null);
  const [googleDisclosureOpen, setGoogleDisclosureOpen] = useState(false);
  const [googleServices, setGoogleServices] = useState<GoogleWorkspaceService[]>([]);
  const [error, setError] = useState<{
    provider: BeennectorProvider;
    message: string;
  } | null>(null);

  const cancelPending = async (provider: BeennectorProvider) => {
    try {
      await disconnect({ provider });
    } catch (cause) {
      captureMobileFailure(cause, 'beennector.cancel', { provider });
    }
  };

  const connect = async (provider: BeennectorProvider) => {
    const authorizationArgs: FunctionArgs<
      typeof api.beennectorAuthActions.beginAuthorization
    > = { provider };
    if (provider === 'google') {
      authorizationArgs.googleServices = googleServices;
      authorizationArgs.googleDisclosureVersion =
        GOOGLE_WORKSPACE_DISCLOSURE_VERSION;
    }
    const { authorizationUrl } = await beginAuthorization(authorizationArgs);
    const result = await WebBrowser.openAuthSessionAsync(
      authorizationUrl,
      APP_REDIRECT_URI,
    );
    if (result.type === 'cancel' || result.type === 'dismiss') {
      await cancelPending(provider);
      return false;
    }
    if (result.type !== 'success') {
      await cancelPending(provider);
      throw new Error(`${PROVIDER_NAMES[provider]} did not finish connecting.`);
    }
    const callback = new URL(result.url);
    if (
      callback.searchParams.get('beennector') !== provider ||
      callback.searchParams.get('status') !== 'connected'
    ) {
      throw new Error(
        `${PROVIDER_NAMES[provider]} authorization did not complete.`,
      );
    }
    return true;
  };

  const toggle = async (provider: BeennectorProvider, disconnecting: boolean) => {
    if (working) return;
    if (provider === 'google' && !disconnecting && !googleDisclosureOpen) {
      setGoogleDisclosureOpen(true);
      setOpenInfo(null);
      return;
    }
    setWorking(provider);
    setError(null);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      if (disconnecting) await disconnect({ provider });
      else await connect(provider);
    } catch (cause) {
      captureMobileFailure(cause, 'beennector.connection', { provider });
      setError({
        provider,
        message: disconnecting
          ? `Could not disconnect ${PROVIDER_NAMES[provider]}. Try again.`
          : `Could not start ${PROVIDER_NAMES[provider]} sign-in. Try again.`,
      });
    } finally {
      setWorking(null);
      if (provider === 'google') setGoogleDisclosureOpen(false);
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
                  (connection.provider === 'notion' ||
                    connection.provider === 'google') &&
                    styles.notionMark,
                ]}
              >
                {MARKS[connection.provider]}
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
              {connected || pending ? (
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
                    {connected ? 'Linked' : 'Waiting'}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {openInfo === connection.provider ? (
              <ThemedText type="small" themeColor="textSecondary">
                {connection.description} Credentials stay encrypted; Bee receives
                only the results of approved Beennector operations.
              </ThemedText>
            ) : null}
            {connection.provider === 'google' && googleDisclosureOpen ? (
              <View style={styles.disclosure}>
                <ThemedText type="small">
                  Choose what BeeGreat may access
                </ThemedText>
                {GOOGLE_WORKSPACE_SERVICES.map((service) => {
                  const selected = googleServices.includes(service.id);
                  return (
                    <Pressable
                      key={service.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() =>
                        setGoogleServices((current) =>
                          selected
                            ? current.filter((item) => item !== service.id)
                            : [...current, service.id],
                        )
                      }
                      style={[styles.service, { borderColor: theme.border }]}
                    >
                      <ThemedText type="small">
                        {selected ? '✓' : '○'} {service.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {service.access}
                      </ThemedText>
                    </Pressable>
                  );
                })}
                <ThemedText type="small" themeColor="textSecondary">
                  {GOOGLE_WORKSPACE_DISCLOSURE}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  By continuing, you consent to this access and processing. Read
                  the Privacy Policy in Profile for full details.
                </ThemedText>
              </View>
            ) : null}
            {'message' in connection && connection.message ? (
              <ThemedText type="small" themeColor="destructive">
                {connection.message}
              </ThemedText>
            ) : null}
            {error?.provider === connection.provider ? (
              <ThemedText type="small" themeColor="destructive" selectable>
                {error.message}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                connected
                  ? `Disconnect ${connection.name}`
                  : pending
                    ? `Cancel ${connection.name} connection`
                    : `Connect ${connection.name}`
              }
              disabled={
                Boolean(working) ||
                (connection.provider === 'google' &&
                  googleDisclosureOpen &&
                  googleServices.length === 0)
              }
              onPress={() =>
                void toggle(connection.provider, connected || pending)
              }
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
                      ? `Cancel ${connection.name}`
                      : connection.provider === 'google' && googleDisclosureOpen
                        ? googleServices.length
                          ? 'I understand — continue to Google'
                          : 'Choose at least one service'
                        : `Connect ${connection.name}`}
                </ThemedText>
              )}
            </Pressable>
          </View>
        );
      })}
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
  disclosure: {
    gap: Spacing.two,
  },
  service: {
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.two,
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
