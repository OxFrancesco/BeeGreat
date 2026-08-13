import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { type ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { makeRoundedPolygonPath } from '@/components/hex-avatar';
import { Fonts, Spacing } from '@/constants/theme';

/** Palette lifted from docs/design/Initial-Page.svg */
export const Hive = {
  cream: '#FEF6E5',
  comb: '#FFDFB5',
  honey: '#FAB52A',
  amber: '#D88909',
  cacao: '#482401',
  bark: '#794D20',
  destructive: '#e54d2e',
} as const;

const BUTTON_HEIGHT = 56;
/** Horizontal run of the angled honeycomb ends (120-degree corners). */
const HEX_END_INSET = BUTTON_HEIGHT / (2 * Math.tan(Math.PI / 3));

/** A wide honeycomb-cell button: flat top and bottom, pointed ends. */
export function HexButton({
  label,
  busy,
  disabled = false,
  icon,
  onPress,
  variant = 'primary',
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const [buttonWidth, setButtonWidth] = useState(0);

  const path = useMemo(() => {
    if (buttonWidth === 0) return null;
    const w = buttonWidth;
    const h = BUTTON_HEIGHT;
    const inset = HEX_END_INSET;
    return makeRoundedPolygonPath(
      [
        { x: 0, y: h / 2 },
        { x: inset, y: 0 },
        { x: w - inset, y: 0 },
        { x: w, y: h / 2 },
        { x: w - inset, y: h },
        { x: inset, y: h },
      ],
      8,
    );
  }, [buttonWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onLayout={(event) => setButtonWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.button,
        disabled && !busy && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {path ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {variant === 'primary' ? (
            <Path path={path} color={Hive.cacao} />
          ) : (
            <>
              <Path path={path} color={Hive.comb} />
              <Group
                transform={[
                  { translateX: buttonWidth / 2 },
                  { translateY: BUTTON_HEIGHT / 2 },
                  { scaleX: (buttonWidth - 3) / buttonWidth },
                  { scaleY: (BUTTON_HEIGHT - 3) / BUTTON_HEIGHT },
                  { translateX: -buttonWidth / 2 },
                  { translateY: -BUTTON_HEIGHT / 2 },
                ]}
              >
                <Path
                  path={path}
                  color={Hive.amber}
                  style="stroke"
                  strokeWidth={1.5}
                />
              </Group>
            </>
          )}
        </Canvas>
      ) : null}
      {busy ? (
        <ActivityIndicator
          color={variant === 'primary' ? Hive.cream : Hive.cacao}
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text
            style={[
              styles.buttonLabel,
              variant === 'secondary' && styles.buttonLabelSecondary,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    height: BUTTON_HEIGHT,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  buttonLabel: {
    fontFamily: Fonts?.rounded,
    fontSize: 17,
    fontWeight: '600',
    color: Hive.cream,
  },
  buttonLabelSecondary: {
    color: Hive.cacao,
  },
});
