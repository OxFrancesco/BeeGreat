import { api } from '@beegreat/backend/convex/_generated/api';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { HydrationTracker } from '@/components/bee-healthy/hydration-tracker';
import { SectionHeader } from '@/components/bee-healthy/section-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
import { useTheme } from '@/hooks/use-theme';
import {
  HYDRATION_GOAL_ML,
  MAX_HYDRATION_ML,
  formatJournalDate,
} from '@/lib/bee-healthy';

export function WaterScreen() {
  const { userId } = useAuth();
  const { localDate, timeZone } = useCurrentLocalDay();

  return (
    <WaterDay
      key={`${userId ?? 'loading'}:${localDate}:${timeZone}`}
      localDate={localDate}
      timeZone={timeZone}
    />
  );
}

function WaterDay({ localDate, timeZone }: { localDate: string; timeZone: string }) {
  const theme = useTheme();
  const entry = useQuery(api.healthJournal.getByDate, { localDate });
  const adjustHydration = useMutation(api.healthJournal.adjustHydration);

  const [optimisticHydration, setOptimisticHydration] = useState<number | null>(null);
  const [lastAddedMl, setLastAddedMl] = useState<number | null>(null);
  const hydrationRequestVersion = useRef(0);

  const hydrationMl = optimisticHydration ?? entry?.hydrationMl ?? 0;
  const hydrationValueRef = useRef(hydrationMl);

  useEffect(() => {
    hydrationValueRef.current = hydrationMl;
  }, [hydrationMl]);

  useEffect(() => {
    if (lastAddedMl === null) return;
    const timeout = setTimeout(() => setLastAddedMl(null), 5000);
    return () => clearTimeout(timeout);
  }, [lastAddedMl]);

  const handleHydrationChange = useCallback(
    async (deltaMl: number, showUndo: boolean) => {
      const currentMl = hydrationValueRef.current;
      const nextMl = Math.min(MAX_HYDRATION_ML, Math.max(0, currentMl + deltaMl));
      const appliedDeltaMl = nextMl - currentMl;
      if (appliedDeltaMl === 0) return;

      const requestVersion = ++hydrationRequestVersion.current;
      hydrationValueRef.current = nextMl;
      setOptimisticHydration(nextMl);
      try {
        const result = await adjustHydration({
          localDate,
          timeZone,
          deltaMl: appliedDeltaMl,
        });
        if (requestVersion === hydrationRequestVersion.current) {
          setOptimisticHydration(null);
          if (showUndo && result.appliedDeltaMl > 0) {
            setLastAddedMl(result.appliedDeltaMl);
            if (process.env.EXPO_OS === 'ios') {
              AccessibilityInfo.announceForAccessibility(
                `Added ${result.appliedDeltaMl} millilitres. Undo available.`,
              );
            }
          }
        }
      } catch (error) {
        if (requestVersion === hydrationRequestVersion.current) {
          setOptimisticHydration(null);
          setLastAddedMl(null);
        }
        Alert.alert(
          'Could not update your water',
          error instanceof Error ? error.message : undefined,
        );
      }
    },
    [adjustHydration, localDate, timeZone],
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <SectionHeader title="Water" subtitle={formatJournalDate(localDate)} />
          {entry === undefined ? (
            <ActivityIndicator color={theme.primary} style={styles.loading} />
          ) : (
            <>
              <HydrationTracker
                valueMl={hydrationMl}
                goalMl={HYDRATION_GOAL_ML}
                onAdd={(amountMl) => void handleHydrationChange(amountMl, true)}
                onRemove={(amountMl) => void handleHydrationChange(-amountMl, false)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage NFC water actions"
                onPress={() => router.push('/nfc-actions')}
                style={({ pressed }) => [
                  styles.nfcCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.nfcIcon, { backgroundColor: theme.secondary }]}>
                  <SymbolView
                    name="wave.3.right"
                    size={20}
                    tintColor={theme.secondaryForeground}
                    fallback={
                      <ThemedText style={{ color: theme.secondaryForeground }}>NFC</ThemedText>
                    }
                  />
                </View>
                <View style={styles.nfcCopy}>
                  <ThemedText type="smallBold">Tap to log water</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Set up a reusable NFC action for your bottle or glass
                  </ThemedText>
                </View>
                <SymbolView
                  name="chevron.right"
                  size={14}
                  tintColor={theme.textSecondary}
                  fallback={<ThemedText themeColor="textSecondary">›</ThemedText>}
                />
              </Pressable>
              {lastAddedMl !== null ? (
                <Animated.View
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOut.duration(140)}
                  style={[styles.undoBar, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText accessibilityLiveRegion="assertive" type="small">
                    Added {lastAddedMl} ml. Undo available.
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Undo adding ${lastAddedMl} millilitres`}
                    hitSlop={Spacing.two}
                    onPress={() => {
                      const amount = lastAddedMl;
                      setLastAddedMl(null);
                      void handleHydrationChange(-amount, false);
                    }}
                  >
                    <ThemedText style={[styles.undoLabel, { color: theme.primary }]}>
                      Undo
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
  undoBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
  },
  undoLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
  nfcCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
  },
  nfcIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderCurve: 'continuous',
  },
  nfcCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.72,
  },
});
