import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';

const tint =
  Platform.OS === 'ios' ? DynamicColorIOS({ light: '#482401', dark: '#FAB52A' }) : '#482401';

export default function BeeHealthyLayout() {
  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Mood</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'face.smiling', selected: 'face.smiling.inverse' }}
          md={{ default: 'sentiment_satisfied', selected: 'mood' }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="water">
        <NativeTabs.Trigger.Label>Water</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'drop', selected: 'drop.fill' }}
          md="water_drop"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="journal">
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.and.pencil', selected: 'square.and.pencil' }}
          md="edit_note"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
