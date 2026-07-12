import { api } from '@beegreat/backend/convex/_generated/api';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { Canvas, Path } from '@shopify/react-native-skia';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type PropsWithChildren, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { HexAvatar, makeHexPath } from '@/components/hex-avatar';
import { Hive } from '@/components/hex-button';
import { InfoButton } from '@/components/info-button';
import { ChatGptAuthSettings } from '@/components/chatgpt/chatgpt-auth';
import { useGoogleHealthAuth } from '@/components/google-health/google-health-auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateGoogleHealthPowerup } from '@/lib/google-health-powerup';
import { setSpeakReplies, useSpeakReplies } from '@/lib/preferences';

/** Icon per power-up id; the glyph is the SymbolView fallback. */
const POWERUP_ICONS: Record<string, { symbol: string; glyph: string }> = {
  web3: { symbol: 'tree.fill', glyph: '⌬' },
  'google-health': { symbol: 'heart.fill', glyph: '♥' },
};
const DEFAULT_POWERUP_ICON = { symbol: 'puzzlepiece.extension.fill', glyph: '⌁' };

const CLOSE_HEX_SIZE = 34;
const CLOSE_HEX_STROKE = 2;

/** Honeycomb-cell close button matching the HexAvatar/HexButton style. */
function HexCloseButton({ onPress }: { onPress: () => void }) {
  const path = useMemo(
    () => makeHexPath(CLOSE_HEX_SIZE, CLOSE_HEX_STROKE / 2, CLOSE_HEX_SIZE / 8),
    [],
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close profile"
      hitSlop={Spacing.two}
      onPress={onPress}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
    >
      <Canvas style={{ width: CLOSE_HEX_SIZE, height: CLOSE_HEX_SIZE }}>
        <Path path={path} color={Hive.comb} />
        <Path path={path} style="stroke" strokeWidth={CLOSE_HEX_STROKE} color={Hive.honey} />
      </Canvas>
      <View style={styles.closeGlyph} pointerEvents="none">
        <SymbolView
          name="xmark"
          size={12}
          weight="bold"
          tintColor={Hive.cacao}
          fallback={
            <ThemedText type="small" style={{ color: Hive.cacao, fontWeight: '700' }}>
              ✕
            </ThemedText>
          }
        />
      </View>
    </Pressable>
  );
}

function Section({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const theme = useTheme();
  const speakReplies = useSpeakReplies();
  const powerups = useQuery(api.powerups.list);
  const setPowerupEnabled = useMutation(api.powerups.setEnabled);
  const googleHealth = useGoogleHealthAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [googleHealthWorking, setGoogleHealthWorking] = useState(false);
  const [googleHealthError, setGoogleHealthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

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

  const handleGoogleHealthToggle = async (enabled: boolean) => {
    if (googleHealthWorking) return;
    setGoogleHealthWorking(true);
    setGoogleHealthError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await updateGoogleHealthPowerup(enabled, {
        connect: googleHealth.connect,
        disconnect: googleHealth.disconnect,
        setEnabled: (nextEnabled) =>
          setPowerupEnabled({
            powerupId: 'google-health',
            enabled: nextEnabled,
          }),
      });
    } catch (cause) {
      setGoogleHealthError(
        cause instanceof Error
          ? cause.message
          : 'Could not connect Google Health. Try again.',
      );
    } finally {
      setGoogleHealthWorking(false);
    }
  };

  return (
    // collapsable={false} keeps this wrapper in the native tree so the form
    // sheet can find the ScrollView (react-native-screens#2424).
    <ThemedView style={styles.container} collapsable={false}>
      {/* Drag-to-dismiss can be flaky with a ScrollView inside a formSheet,
          so the sheet always offers an explicit close button. */}
      <HexCloseButton onPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.identityCard, { backgroundColor: theme.secondary }]}>
          <HexAvatar size={72} uri={user?.hasImage ? user.imageUrl : null} />
          <View style={styles.identity}>
            <ThemedText style={[styles.name, { color: theme.secondaryForeground }]}>
              {name}
            </ThemedText>
            {email ? (
              <ThemedText
                type="small"
                style={[styles.email, { color: theme.secondaryForeground }]}
              >
                {email}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <Section label="Preferences">
          <View
            style={[
              styles.settingRow,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={styles.settingCopy}>
              <ThemedText type="default">Speak replies</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {speakReplies
                  ? 'Bee reads answers aloud'
                  : 'Replies stay on screen'}
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
        </Section>

        <Section label="Connections">
          <ChatGptAuthSettings />
        </Section>

        {powerups && powerups.length > 0 ? (
          <Section label="Power-ups">
            {powerups.map((powerup) => {
              const icon = POWERUP_ICONS[powerup.id] ?? DEFAULT_POWERUP_ICON;
              const isGoogleHealth = powerup.id === 'google-health';
              const googleHealthConnected =
                googleHealth.status?.state === 'connected';
              const switchEnabled = isGoogleHealth
                ? googleHealthWorking ||
                  (powerup.enabled && googleHealthConnected)
                : powerup.enabled;
              return (
                <View
                  key={powerup.id}
                  style={[
                    styles.powerupCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.powerupRow}>
                    <View style={[styles.powerupIcon, { backgroundColor: theme.secondary }]}>
                      <SymbolView
                        name={icon.symbol as never}
                        size={18}
                        tintColor={theme.secondaryForeground}
                        fallback={
                          <ThemedText style={{ color: theme.secondaryForeground }}>
                            {icon.glyph}
                          </ThemedText>
                        }
                      />
                    </View>
                    <View style={styles.powerupTitleRow}>
                      <ThemedText type="default" style={styles.powerupName}>
                        {powerup.name}
                      </ThemedText>
                      <InfoButton
                        active={openInfoId === powerup.id}
                        label={`About the ${powerup.name} power-up`}
                        onPress={() =>
                          setOpenInfoId(openInfoId === powerup.id ? null : powerup.id)
                        }
                      />
                    </View>
                    <Switch
                      accessibilityLabel={`${powerup.name} power-up`}
                      disabled={isGoogleHealth && googleHealthWorking}
                      value={switchEnabled}
                      onValueChange={(enabled) => {
                        if (isGoogleHealth) {
                          void handleGoogleHealthToggle(enabled);
                          return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void setPowerupEnabled({ powerupId: powerup.id, enabled });
                      }}
                      trackColor={{ true: theme.primary }}
                    />
                  </View>
                  {openInfoId === powerup.id ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {powerup.description}
                    </ThemedText>
                  ) : null}
                  {isGoogleHealth && !googleHealthWorking &&
                  (googleHealthError ||
                    (powerup.enabled && googleHealth.status?.message)) ? (
                    <ThemedText type="small" themeColor="destructive">
                      {googleHealthError ?? googleHealth.status?.message}
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </Section>
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
    right: Spacing.four,
    zIndex: 1,
    width: CLOSE_HEX_SIZE,
    height: CLOSE_HEX_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  identityCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  name: {
    fontFamily: Fonts?.rounded,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  email: {
    opacity: 0.75,
  },
  section: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
    lineHeight: 16,
    marginLeft: Spacing.one,
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
  powerupCard: {
    alignSelf: 'stretch',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  powerupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  powerupIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerupTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  powerupName: {
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
