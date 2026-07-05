import { useClerk, useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { HexAvatar } from '@/components/hex-avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setSpeakReplies, useSpeakReplies } from '@/lib/preferences';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useTheme();
  const speakReplies = useSpeakReplies();
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

      <View style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.settingCopy}>
          <ThemedText type="default">Speak replies</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {speakReplies ? 'Bee reads answers aloud' : 'Replies stay on screen'}
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Speak replies aloud"
          value={speakReplies}
          onValueChange={(enabled) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSpeakReplies(enabled);
          }}
          trackColor={{ true: theme.primary }}
        />
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
  settingRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  settingCopy: {
    gap: Spacing.half,
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
