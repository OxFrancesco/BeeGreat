import { ScrollView, View } from 'react-native';
import { HealthStreaks } from '@/components/bee-healthy/health-streaks';
import { SectionHeader } from '@/components/bee-healthy/section-header';
import { ThemedView } from '@/components/themed-view';
import { useCurrentLocalDay } from '@/hooks/use-current-local-day';
export default function StreaksScreen() {
  const { localDate } = useCurrentLocalDay();
  return <ThemedView style={{ flex: 1 }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
    <View style={{ width: '100%', maxWidth: 800, gap: 16 }}><SectionHeader title="Streaks" /><HealthStreaks localDate={localDate} /></View>
  </ScrollView></ThemedView>;
}
