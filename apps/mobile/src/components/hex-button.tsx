import { Canvas, Path } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { makeRoundedPolygonPath } from '@/components/hex-avatar';
import { Fonts } from '@/constants/theme';

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
  onPress,
}: {
  label: string;
  busy: boolean;
  onPress: () => void;
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
      onPress={onPress}
      onLayout={(event) => setButtonWidth(event.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {path ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={path} color={Hive.cacao} />
        </Canvas>
      ) : null}
      {busy ? (
        <ActivityIndicator color={Hive.cream} />
      ) : (
        <Text style={styles.buttonLabel}>{label}</Text>
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
  buttonLabel: {
    fontFamily: Fonts?.rounded,
    fontSize: 17,
    fontWeight: '600',
    color: Hive.cream,
  },
});
