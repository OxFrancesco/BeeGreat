import type { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path,
  useImage,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { Link, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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

function HexBookmark({ bookmark, size }: { bookmark: BookmarkItem; size: number }) {
  const image = useImage(bookmark.meta?.imageUrl ?? null);
  const path = useMemo(() => makeHexPath(size, 2, size / 12), [size]);
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={path} color={bookmark.status === 'failed' ? '#F8D8CF' : '#FFDFB5'} />
        {image ? (
          <Group clip={path}>
            <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="cover" />
          </Group>
        ) : null}
        <Path path={path} style="stroke" strokeWidth={3} color="#F5BD62" />
      </Canvas>
      <View style={styles.hexOverlay}>
        <View style={styles.kindBadge}>
          <SymbolView name={KIND_SYMBOL[bookmark.kind]} size={13} tintColor="#582D1D" />
        </View>
        <ThemedText
          type="smallBold"
          numberOfLines={3}
          style={[styles.hexTitle, image && styles.hexTitleOnImage]}
        >
          {bookmark.status === 'pending' || bookmark.status === 'processing'
            ? 'Gathering…'
            : bookmark.status === 'failed'
              ? 'Tap to retry'
              : bookmark.title ?? sourceLabel(bookmark)}
        </ThemedText>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '18%',
    paddingVertical: '17%',
  },
  kindBadge: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 239, 214, 0.92)',
  },
  hexTitle: { textAlign: 'center', color: '#582D1D' },
  hexTitleOnImage: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(27, 17, 8, 0.68)',
    color: '#FFFFFF',
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
