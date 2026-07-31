import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  ScreenshotFixtureProvider,
  type ScreenshotFixtureValue,
  type ScreenshotShot,
} from '@/lib/screenshot-fixture';

import {
  SCREENSHOT_BOOKMARK_LABELS,
  SCREENSHOT_BOOKMARKS,
  SCREENSHOT_GOALS,
  SCREENSHOT_HIVE,
  SCREENSHOT_HIVE_COMPLETION,
  SCREENSHOT_PROJECT,
  SCREENSHOT_TASKS,
  SCREENSHOT_THREADS,
  screenshotAgent,
} from './fixtures';

const CONFIRMED_BUNDLE = {
  goalId: SCREENSHOT_HIVE.activeGoals[0].goalId,
  projectId: SCREENSHOT_PROJECT.id,
  taskId: SCREENSHOT_TASKS[1]!.id,
  highlightId: SCREENSHOT_HIVE.activeHighlight.highlightId,
  golieBeeId: SCREENSHOT_HIVE.activeGoals[0].golieBee.golieBeeId,
};

export function ScreenshotHarnessRoot() {
  const [shot, selectShot] = useState<ScreenshotShot>('bee-focus');
  const colorScheme = useColorScheme();
  const fixture = useMemo<ScreenshotFixtureValue>(
    () => ({
      shot,
      selectShot,
      agent: screenshotAgent(shot),
      goals: SCREENSHOT_GOALS,
      project: SCREENSHOT_PROJECT,
      tasks: SCREENSHOT_TASKS,
      hive: SCREENSHOT_HIVE,
      hiveCompletion: SCREENSHOT_HIVE_COMPLETION,
      bookmarks: SCREENSHOT_BOOKMARKS,
      bookmarkLabels: SCREENSHOT_BOOKMARK_LABELS,
      mindView: 'cards',
      threads: SCREENSHOT_THREADS,
      activeThread: SCREENSHOT_THREADS[0]!.id,
      confirmFirstFocus: async (args) =>
        args.confirmed
          ? { status: 'created', bundle: CONFIRMED_BUNDLE }
          : { status: 'cancelled', bundle: null },
    }),
    [shot],
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ScreenshotFixtureProvider value={fixture}>
        <ThemeProvider
          value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <View style={styles.root}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="screenshot-harness" />
              <Stack.Screen
                name="threads"
                options={{
                  presentation: 'formSheet',
                  sheetAllowedDetents: [0.6, 1],
                  sheetGrabberVisible: true,
                  contentStyle: { height: '100%' },
                }}
              />
            </Stack>
            <View
              accessible
              accessibilityLabel={`BeeGreat screenshot fixture ready: ${shot}`}
              pointerEvents="none"
              style={styles.captureHandshake}
            />
          </View>
        </ThemeProvider>
      </ScreenshotFixtureProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  captureHandshake: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    top: 0,
    left: 0,
  },
});
