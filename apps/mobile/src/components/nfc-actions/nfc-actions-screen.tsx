import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { NfcActionTypeConfig } from './nfc-action-type-screen';
import { NfcActionTypeScreen } from './nfc-action-type-screen';

const WATER_AMOUNTS = [250, 330, 500, 750] as const;

function AmountPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (amount: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.amounts} accessibilityRole="radiogroup">
      {WATER_AMOUNTS.map((amount) => {
        const selected = value === amount;
        return (
          <Pressable
            key={amount}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onChange(amount);
            }}
            style={({ pressed }) => [
              styles.amount,
              {
                backgroundColor: selected ? theme.secondary : theme.backgroundElement,
                borderColor: selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText
              type="smallBold"
              style={selected ? { color: theme.secondaryForeground } : undefined}
            >
              {amount} ml
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const hydrationConfig: NfcActionTypeConfig = {
  type: 'hydration',
  noun: 'tap action',
  intro: {
    title: 'One tag, one useful action',
    body: 'The tag stores a private BeeGreat link. Its action stays here, so you can change the amount later without touching the tag again.',
  },
  listTitle: 'Your tap actions',
  createTitle: 'New water action',
  defaultLabel: 'Water bottle',
  labelPlaceholder: 'Water bottle',
  labelFieldName: 'NFC action name',
  editorHint: 'The same NFC tag will use the new amount—no rewrite needed.',
  icon: {
    symbol: 'drop.fill',
    glyph: '●',
    colors: () => ({ background: '#DDF3FA', foreground: '#2F8795' }),
  },
  subtitle: (action) =>
    action.definition.type === 'hydration'
      ? `Add ${action.definition.amountMl} ml of water`
      : '',
  defaultDefinition: { type: 'hydration', amountMl: 250 },
  DefinitionField: ({ value, onChange, context }) => {
    if (value.type !== 'hydration') return null;
    const picker = (
      <AmountPicker
        value={value.amountMl}
        onChange={(amountMl) => onChange({ type: 'hydration', amountMl })}
      />
    );
    if (context === 'edit') return picker;
    return (
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Amount per tap
        </ThemedText>
        {picker}
      </View>
    );
  },
};

export function NfcActionsScreen() {
  return <NfcActionTypeScreen config={hydrationConfig} />;
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  amount: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
  },
  pressed: { opacity: 0.72 },
});
