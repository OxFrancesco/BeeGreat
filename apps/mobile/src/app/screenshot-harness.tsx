import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  isScreenshotShot,
  useScreenshotFixture,
  type ScreenshotShot,
} from '@/lib/screenshot-fixture';

const TARGETS: Record<ScreenshotShot, Href> = {
  'bee-focus': '/',
  'goals-plan': '/goals/project/fixture_project',
  'hive-progress': '/hive',
  'voice-with-bee': '/',
  'mind-bookmarks': '/mind',
};

export default function ScreenshotHarnessRoute() {
  const fixture = useScreenshotFixture();
  const { shot } = useLocalSearchParams<{ shot?: string }>();
  const requested = typeof shot === 'string' && isScreenshotShot(shot) ? shot : null;

  useEffect(() => {
    if (!__DEV__ || !fixture || !requested) return;
    fixture.selectShot(requested);
    router.replace(TARGETS[requested]);
  }, [fixture, requested]);

  if (!__DEV__ || !fixture || !requested) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.loading}>
      <ActivityIndicator />
      <ThemedText type="small" themeColor="textSecondary">
        Preparing fictional App Store data…
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
