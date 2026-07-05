import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { FlueProvider } from '@flue/react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { flueClient } from '@/lib/flue';

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <FlueProvider client={flueClient}>
          <RootNavigator />
        </FlueProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="profile"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.45],
              sheetGrabberVisible: true,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
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
});
