import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

import { emitMicPress } from '@/lib/mic-bus';

const tint =
  Platform.OS === 'ios' ? DynamicColorIOS({ light: '#482401', dark: '#FAB52A' }) : '#482401';

export default function TabLayout() {
  return (
    <NativeTabs tintColor={tint}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bee</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/icons/bee.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="goals">
        <NativeTabs.Trigger.Label>Goals</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/icons/honeycomb.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="hive">
        <NativeTabs.Trigger.Label>Hive</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../../assets/icons/hive.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="mic"
        // The search role splits this trigger into its own pill on iOS 26,
        // visually separating Talk from the navigation tabs.
        role="search"
        // Disabled tabs still emit tabPress but never navigate, which turns
        // this trigger into a plain button for toggling voice recording.
        disabled
        listeners={{
          tabPress: () => {
            emitMicPress();
          },
        }}
      >
        <NativeTabs.Trigger.Label>Talk</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          // Original rendering keeps the honey-colored microphone instead of
          // the system tint, so the Talk button stands out from the other tabs.
          src={require('../../../assets/icons/mic-honey.png')}
          renderingMode="original"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
