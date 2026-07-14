import { Stack } from 'expo-router';

export default function MindLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
      }}
    >
      {/* The index screen draws its own title row (title + add button on one
          line, like Goals); UIKit cannot place bar buttons on the large-title
          row. */}
      <Stack.Screen name="index" options={{ title: 'Mind', headerShown: false }} />
      <Stack.Screen
        name="[bookmarkId]"
        options={{ title: 'Bookmark', headerLargeTitle: false }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: 'Save to Mind',
          headerLargeTitle: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 0.9],
          sheetGrabberVisible: true,
          contentStyle: { height: '100%' },
        }}
      />
    </Stack>
  );
}
