import { Canvas, Path } from '@shopify/react-native-skia';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { makeRoundedPolygonPath } from '@/components/hex-avatar';
import { ThemedText } from '@/components/themed-text';

/** Honeycomb palette shared with HexAvatar. */
const Hex = {
  fill: '#FFDFB5',
  stroke: '#FAB52A',
  glyph: '#482401',
} as const;

/** Builds a pointy-top hexagon with rounded corners, inset for the stroke. */
function makeHexPath(size: number, inset: number, cornerRadius: number) {
  const c = size / 2;
  const radius = c - inset;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  });
  return makeRoundedPolygonPath(points, cornerRadius);
}

/** Hexagonal icon button in the honeycomb style, sized to match HexAvatar. */
export function HexIconButton({
  size,
  icon,
  fallbackGlyph,
  accessibilityLabel,
  onPress,
}: {
  size: number;
  icon: SymbolViewProps['name'];
  /** Text stand-in for platforms without SF Symbols. */
  fallbackGlyph: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const strokeWidth = Math.max(1.5, size / 24);
  const path = useMemo(() => makeHexPath(size, strokeWidth / 2, size / 8), [size, strokeWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}
    >
      <Canvas style={{ width: size, height: size }}>
        <Path path={path} color={Hex.fill} />
        <Path path={path} style="stroke" strokeWidth={strokeWidth} color={Hex.stroke} />
      </Canvas>
      <View style={styles.icon} pointerEvents="none">
        <SymbolView
          name={icon}
          size={size * 0.45}
          tintColor={Hex.glyph}
          fallback={
            <ThemedText type="smallBold" style={{ color: Hex.glyph }}>
              {fallbackGlyph}
            </ThemedText>
          }
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
