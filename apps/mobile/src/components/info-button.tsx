import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * Small themed disclosure toggle for inline "what does this do?" hints.
 * Cards render their hint text themselves when `active` is true.
 */
export function InfoButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: active }}
      hitSlop={10}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <SymbolView
        name={active ? 'info.circle.fill' : 'info.circle'}
        size={15}
        tintColor={active ? theme.primary : theme.textSecondary}
        fallback={
          <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
            ⓘ
          </ThemedText>
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
