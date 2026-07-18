// The development screenshot fixture now runs through the real Expo Router
// tree. RootLayout swaps only the live data adapters when its dev-only flag is
// enabled, so every capture renders the shipping screens and native tabs.
if (
  __DEV__ &&
  process.env.EXPO_PUBLIC_BEEGREAT_SCREENSHOT_HARNESS === '1'
) {
  // Store screenshots must never contain React Native's development warning
  // banner. This runs before Expo Router imports the application tree so even
  // warnings emitted during module initialization are suppressed.
  const { LogBox } = require('react-native');
  LogBox.ignoreAllLogs(true);
}

require('expo-router/entry');
