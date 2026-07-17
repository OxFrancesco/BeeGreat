import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { FlueProvider } from '@flue/react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
  useNavigationContainerRef,
} from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { VoiceAgentProvider } from '@/components/agent/voice-agent-provider';
import { ChatGptAuthGate } from '@/components/chatgpt/chatgpt-auth';
import { Colors } from '@/constants/theme';
import { flueClient } from '@/lib/flue';
import { Sentry, sentryNavigationIntegration } from '@/lib/sentry';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function RootLayout() {
  return (
    <KeyboardProvider>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
        tokenCache={tokenCache}
      >
        <SentryUserContext />
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <FlueProvider client={flueClient}>
            <RootNavigator />
          </FlueProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </KeyboardProvider>
  );
}

export default Sentry.wrap(RootLayout);

function SentryUserContext() {
  const { user } = useUser();

  useEffect(() => {
    Sentry.setUser(user?.id ? { id: user.id } : null);
  }, [user?.id]);

  return null;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error, {
      mechanism: { type: 'expo-router.error-boundary', handled: true },
    });
  }, [error]);

  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Bee hit an unexpected problem.</Text>
      <Text style={styles.errorBody}>
        The failure was reported. Try this screen again.
      </Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isLoaded, isSignedIn } = useAuth();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    sentryNavigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  const navigator = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="profile"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.45, 1],
            sheetGrabberVisible: true,
            // formSheet content collapses to zero height without this once it
            // holds a ScrollView (react-native-screens#2522).
            contentStyle: { height: '100%' },
          }}
        />
        <Stack.Screen
          name="threads"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.6, 1],
            sheetGrabberVisible: true,
            // formSheet content collapses to zero height without this once it
            // holds a ScrollView (react-native-screens#2522).
            contentStyle: { height: '100%' },
          }}
        />
        <Stack.Screen name="share" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* The voice agent lives above the navigator so mic state, the Live
          Activity, and the island pill survive tab switches app-wide. */}
      {isSignedIn ? (
        <ChatGptAuthGate>
          <VoiceAgentProvider>{navigator}</VoiceAgentProvider>
        </ChatGptAuthGate>
      ) : navigator}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF6E5',
  },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: '#FEF6E5',
  },
  errorTitle: {
    color: '#251A0D',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: '#6A4E2A',
    fontSize: 16,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F5A623',
  },
  retryLabel: {
    color: '#251A0D',
    fontSize: 16,
    fontWeight: '700',
  },
});
