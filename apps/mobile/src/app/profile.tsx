import { useClerk, useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { HexAvatar } from '@/components/hex-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = user?.fullName ?? user?.username ?? 'Beekeeper';
  const email = user?.primaryEmailAddress?.emailAddress;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signOut();
      // The auth guard unmounts this sheet and shows the sign-in screen.
    } catch {
      setError("Couldn't sign you out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <HexAvatar size={72} uri={user?.hasImage ? user.imageUrl : null} />
      <View style={styles.identity}>
        <ThemedText type="default" style={styles.name}>
          {name}
        </ThemedText>
        {email ? (
          <ThemedText type="small" themeColor="textSecondary">
            {email}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.signOut,
          { borderColor: theme.destructive },
          pressed && styles.pressed,
        ]}
      >
        {signingOut ? (
          <ActivityIndicator color={theme.destructive} />
        ) : (
          <ThemedText type="default" themeColor="destructive">
            Sign out
          </ThemedText>
        )}
      </Pressable>
      {error ? (
        <ThemedText type="small" themeColor="destructive">
          {error}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  name: {
    fontWeight: '600',
  },
  signOut: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
