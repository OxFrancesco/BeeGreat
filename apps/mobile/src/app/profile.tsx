import { api } from '@beegreat/backend/convex/_generated/api';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

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
  const powerups = useQuery(api.powerups.list);
  const setPowerupEnabled = useMutation(api.powerups.setEnabled);
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
    // collapsable={false} keeps this wrapper in the native tree so the form
    // sheet can find the ScrollView (react-native-screens#2424).
    <ThemedView style={styles.container} collapsable={false}>
      {/* Drag-to-dismiss can be flaky with a ScrollView inside a formSheet,
          so the sheet always offers an explicit close button. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close profile"
        hitSlop={Spacing.two}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <SymbolView
          name="xmark"
          size={13}
          tintColor={theme.textSecondary}
          fallback={<ThemedText type="small" themeColor="textSecondary">✕</ThemedText>}
        />
      </Pressable>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

        {powerups && powerups.length > 0 ? (
          <View style={styles.powerups}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
              Power-ups
            </ThemedText>
            {powerups.map((powerup) => (
              <View
                key={powerup.id}
                style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.settingCopy}>
                  <ThemedText type="default">{powerup.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {powerup.enabled ? powerup.tagline : powerup.description}
                  </ThemedText>
                </View>
                <Switch
                  accessibilityLabel={`${powerup.name} power-up`}
                  value={powerup.enabled}
                  onValueChange={(enabled) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPowerupEnabled({ powerupId: powerup.id, enabled });
                  }}
                  trackColor={{ true: theme.primary }}
                />
              </View>
            ))}
          </View>
        ) : null}

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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  close: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
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
    flex: 1,
    gap: Spacing.half,
  },
  powerups: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
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
