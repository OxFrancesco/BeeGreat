import type { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient,
  Path,
  Shadow,
  Skia,
  TextPath,
  matchFont,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { makeHexPath } from '@/components/hex-avatar';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { MindView } from '@/lib/preferences';

export type BookmarkItem = FunctionReturnType<typeof api.bookmarks.list>['page'][number];

const KIND_SYMBOL = {
  website: 'safari.fill',
  tweet: 'bubble.left.and.bubble.right.fill',
  youtube: 'play.fill',
} as const;

function sourceLabel(bookmark: BookmarkItem) {
  if (bookmark.meta?.handle) return `@${bookmark.meta.handle}`;
  if (bookmark.meta?.author) return bookmark.meta.author;
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./, '');
  } catch {
    return bookmark.kind;
  }
}

export function BookmarkCell({
  bookmark,
  view,
  width,
}: {
  bookmark: BookmarkItem;
  view: MindView;
  width: number;
}) {
  const href = { pathname: '/mind/[bookmarkId]' as const, params: { bookmarkId: bookmark._id } };
  return (
    <Link href={href as unknown as Href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${bookmark.title ?? sourceLabel(bookmark)}`}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {view === 'hex' ? (
          <HexBookmark bookmark={bookmark} size={width} />
        ) : view === 'cards' ? (
          <CardBookmark bookmark={bookmark} width={width} />
        ) : (
          <ListBookmark bookmark={bookmark} />
        )}
      </Pressable>
    </Link>
  );
}

/** Wax-cell palette for the honeycomb view. */
const Comb = {
  fillTop: '#FFEBC4',
  fillBottom: '#FCC968',
  failedTop: '#FBE0D6',
  failedBottom: '#F3B39E',
  wall: '#E39A2E',
  wallInner: 'rgba(255, 250, 235, 0.85)',
  rimShadow: 'rgba(126, 74, 5, 0.28)',
  text: '#582D1D',
  arcText: '#8A5410',
} as const;

const arcFontFamily = Platform.select({ ios: 'Avenir', default: 'sans-serif-medium' });

function HexBookmark({ bookmark, size }: { bookmark: BookmarkItem; size: number }) {
  const image = useImage(bookmark.meta?.imageUrl ?? null);
  const theme = useTheme();
  const failed = bookmark.status === 'failed';
  const wall = Math.max(3, size / 34);
  const path = useMemo(() => makeHexPath(size, wall / 2 + 2, size / 26), [size, wall]);
  const innerPath = useMemo(
    () => makeHexPath(size, wall * 1.6 + 2, size / 28),
    [size, wall],
  );

  // Curved site name hugging the top edges inside the cell.
  const arcFontSize = Math.max(9, size * 0.062);
  const arc = useMemo(() => {
    const font = matchFont({
      fontFamily: arcFontFamily,
      fontSize: arcFontSize,
      fontWeight: 'bold',
    });
    const c = size / 2;
    const r = c - wall * 2.6 - arcFontSize * 1.5;
    const rect = Skia.XYWHRect(c - r, c - r, r * 2, r * 2);
    const builder = Skia.PathBuilder.Make();
    builder.addArc(rect, -150, 120);
    const textPath = builder.build();
    const arcLength = (Math.PI * r * 120) / 180;
    let label = sourceLabel(bookmark).toUpperCase();
    let width = font.getTextWidth(label);
    while (label.length > 4 && width > arcLength * 0.92) {
      label = `${label.slice(0, -2).replace(/…$/, '')}…`;
      width = font.getTextWidth(label);
    }
    return { font, textPath, label, offset: Math.max(0, (arcLength - width) / 2) };
  }, [arcFontSize, bookmark, size, wall]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Wax cell body with honey gradient and soft depth. */}
        <Path path={path} color={Comb.fillBottom}>
          <LinearGradient
            start={vec(size / 2, 0)}
            end={vec(size / 2, size)}
            colors={failed ? [Comb.failedTop, Comb.failedBottom] : [Comb.fillTop, Comb.fillBottom]}
          />
          <Shadow dx={0} dy={2} blur={5} color={Comb.rimShadow} inner />
        </Path>
        {image ? (
          <Group clip={path}>
            <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="cover" />
            {/* Honey scrim keeps the curved label and title legible over art. */}
            <Path path={path} color="rgba(48, 26, 4, 0.42)" />
          </Group>
        ) : null}
        {/* Inner highlight rim gives the wax-wall bevel. */}
        <Path
          path={innerPath}
          style="stroke"
          strokeWidth={Math.max(1.5, wall / 2)}
          color={image ? 'rgba(255, 244, 214, 0.4)' : Comb.wallInner}
        />
        {/* Outer cell wall. */}
        <Path path={path} style="stroke" strokeWidth={wall} color={Comb.wall}>
          <Shadow dx={0} dy={1.5} blur={3} color={Comb.rimShadow} />
        </Path>
        {/* Site name curved along the top edge of the cell. */}
        <TextPath
          font={arc.font}
          path={arc.textPath}
          text={arc.label}
          initialOffset={arc.offset}
          color={image ? '#FFE9BE' : '#FF0000'}
        />
      </Canvas>
      <View style={styles.hexOverlay}>
        <FaviconBadge bookmark={bookmark} size={Math.max(40, size * 0.32)} />
      </View>
      {(bookmark.status === 'pending' || bookmark.status === 'processing') && (
        <View
          pointerEvents="none"
          style={[styles.pendingWash, { borderColor: theme.border }]}
        />
      )}
    </View>
  );
}

function FaviconBadge({ bookmark, size }: { bookmark: BookmarkItem; size: number }) {
  const favicon = useImage(bookmark.meta?.faviconUrl ?? null);
  const stroke = Math.max(2, size / 18);
  const path = useMemo(
    () => makeHexPath(size, stroke / 2 + 1, size / 26),
    [size, stroke],
  );
  const inset = size * 0.22;
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={path} color="rgba(255, 246, 228, 0.97)">
          <Shadow dx={0} dy={1.5} blur={3} color={Comb.rimShadow} />
        </Path>
        {favicon ? (
          <Group clip={path}>
            <SkiaImage
              image={favicon}
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              fit="contain"
            />
          </Group>
        ) : null}
        <Path path={path} style="stroke" strokeWidth={stroke} color={Comb.wall} />
      </Canvas>
      {!favicon ? (
        <View style={styles.badgeGlyph} pointerEvents="none">
          <SymbolView name={KIND_SYMBOL[bookmark.kind]} size={size * 0.4} tintColor={Comb.text} />
        </View>
      ) : null}
    </View>
  );
}

function CardBookmark({ bookmark, width }: { bookmark: BookmarkItem; width: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { width, backgroundColor: theme.card, borderColor: theme.border }]}>
      {bookmark.meta?.imageUrl ? (
        <Image source={bookmark.meta.imageUrl} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardFallback]}>
          <SymbolView name={KIND_SYMBOL[bookmark.kind]} size={28} tintColor="#A86A16" />
        </View>
      )}
      <View style={styles.cardCopy}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {bookmark.title ?? sourceLabel(bookmark)}
        </ThemedText>
        {bookmark.summary ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
            {bookmark.summary}
          </ThemedText>
        ) : null}
        <LabelRow labels={bookmark.labels.slice(0, 2)} />
      </View>
    </View>
  );
}

function ListBookmark({ bookmark }: { bookmark: BookmarkItem }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.listIcon}>
        <SymbolView name={KIND_SYMBOL[bookmark.kind]} size={18} tintColor="#A86A16" />
      </View>
      <View style={styles.rowCopy}>
        <ThemedText numberOfLines={1}>{bookmark.title ?? sourceLabel(bookmark)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sourceLabel(bookmark)} · {new Date(bookmark.createdAt).toLocaleDateString()}
        </ThemedText>
      </View>
      <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
    </View>
  );
}

function LabelRow({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.labels}>
      {labels.map((label) => (
        <View key={label} style={styles.label}>
          <ThemedText type="small" numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  hexOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '7%',
  },
  badgeGlyph: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  cardImage: { width: '100%', height: 112 },
  cardFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0D7' },
  cardCopy: { gap: 7, padding: 12 },
  labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  label: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFDFB5' },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: { flex: 1 },
  listIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: '#FFF0D7',
  },
});
