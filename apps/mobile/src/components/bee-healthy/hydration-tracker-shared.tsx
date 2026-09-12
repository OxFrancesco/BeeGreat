import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/themed-text';
import { WaterBottle } from './water-bottle';
import { useTheme } from '@/hooks/use-theme';
import { MAX_HYDRATION_ML } from '@/lib/bee-healthy';
export type HydrationTrackerProps = { valueMl: number; goalMl: number; onAdd: (amountMl: number) => void; onRemove: (amountMl: number) => void; disabled?: boolean };
export function HydrationTracker({ valueMl, goalMl, onAdd, onRemove, disabled = false }: HydrationTrackerProps) {
  const theme = useTheme();
  const ratio = Math.max(0, Math.min(1, valueMl / goalMl));
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <View style={{ flex: .85 }}><WaterBottle valueMl={valueMl} /></View>
      <View style={{ flex: 1, gap: 8 }}>
        <ThemedText style={styles.amount}>{valueMl.toLocaleString()} ml</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">of {goalMl.toLocaleString()} ml</ThemedText>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: goalMl, now: Math.min(valueMl, goalMl) }} style={{ height: 6, borderRadius: 3, backgroundColor: theme.backgroundElement }}><View style={{ width: `${ratio * 100}%`, height: 6, borderRadius: 3, backgroundColor: '#55BEE2' }} /></View>
        <ThemedText type="smallBold">{ratio === 1 ? 'Goal reached' : `${goalMl - valueMl} ml to go`}</ThemedText>
        {valueMl > goalMl ? <ThemedText type="small" themeColor="textSecondary">{valueMl - goalMl} ml extra</ThemedText> : null}
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 8 }}>{[-250, 250, 500].map(amount => {
      const off = disabled || (amount < 0 ? valueMl === 0 : valueMl >= MAX_HYDRATION_ML);
      return <Pressable key={amount} accessibilityRole="button" accessibilityLabel={`${amount < 0 ? 'Remove' : 'Add'} ${Math.abs(amount)} millilitres`} accessibilityState={{ disabled: off }} disabled={off}
        onPress={() => { if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (amount < 0) onRemove(-amount); else onAdd(amount); }}
        style={({ pressed }) => [styles.action, { backgroundColor: amount === 250 ? theme.primary : theme.card, borderColor: theme.border, opacity: off ? .4 : pressed ? .72 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: amount === 250 ? theme.primaryForeground : theme.text }}>{amount < 0 ? '−250' : `+${amount}`}</ThemedText>
      </Pressable>;
    })}</View>
  </View>;
}
const styles = StyleSheet.create({ amount: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] }, action: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth } });
