import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/** Honeycomb palette shared with the sign-in scene. */
const Hex = {
  fill: '#FFDFB5',
  stroke: '#FAB52A',
  glyph: '#482401',
} as const;

/** Builds a closed path through `points` with rounded corners. */
export function makeRoundedPolygonPath(
  points: { x: number; y: number }[],
  cornerRadius: number,
) {
  const count = points.length;
  const builder = Skia.PathBuilder.Make();
  points.forEach((vertex, i) => {
    const prev = points[(i + count - 1) % count];
    const next = points[(i + 1) % count];
    const toPrev = { x: prev.x - vertex.x, y: prev.y - vertex.y };
    const toNext = { x: next.x - vertex.x, y: next.y - vertex.y };
    const prevLen = Math.hypot(toPrev.x, toPrev.y);
    const nextLen = Math.hypot(toNext.x, toNext.y);
    const rPrev = Math.min(cornerRadius, prevLen / 2) / prevLen;
    const rNext = Math.min(cornerRadius, nextLen / 2) / nextLen;
    const entry = { x: vertex.x + toPrev.x * rPrev, y: vertex.y + toPrev.y * rPrev };
    const exit = { x: vertex.x + toNext.x * rNext, y: vertex.y + toNext.y * rNext };
    if (i === 0) {
      builder.moveTo(entry.x, entry.y);
    } else {
      builder.lineTo(entry.x, entry.y);
    }
    builder.quadTo(vertex.x, vertex.y, exit.x, exit.y);
  });
  builder.close();
  return builder.build();
}

/** Builds a pointy-top hexagon with rounded corners, inset for the stroke. */
export function makeHexPath(size: number, inset: number, cornerRadius: number) {
  const c = size / 2;
  const radius = c - inset;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return { x: c + radius * Math.cos(angle), y: c + radius * Math.sin(angle) };
  });
  return makeRoundedPolygonPath(points, cornerRadius);
}

/**
 * Hexagonal avatar in the honeycomb style. Renders the profile image clipped
 * to a hex cell, or a honey-filled cell with a person glyph as fallback.
 */
export function HexAvatar({ size, uri }: { size: number; uri?: string | null }) {
  const image = useImage(uri ?? null);
  const strokeWidth = Math.max(1.5, size / 24);
  const path = useMemo(
    () => makeHexPath(size, strokeWidth / 2, size / 8),
    [size, strokeWidth],
  );

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        <Path path={path} color={Hex.fill} />
        {image ? (
          <Group clip={path}>
            <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="cover" />
          </Group>
        ) : null}
        <Path path={path} style="stroke" strokeWidth={strokeWidth} color={Hex.stroke} />
      </Canvas>
      {!image && Platform.OS === 'ios' ? (
        <View style={styles.glyph} pointerEvents="none">
          <SymbolView name="person.fill" size={size * 0.42} tintColor={Hex.glyph} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
