import { api } from '@beegreat/backend/convex/_generated/api';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { ScreenHeader } from '@/components/goals/screen-header';
import { BookmarkCell, type BookmarkItem } from '@/components/mind/bookmark-item';
import { ViewSwitcher } from '@/components/mind/view-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMindView } from '@/lib/preferences';

type Kind = 'website' | 'tweet' | 'youtube';

const KINDS: { value?: Kind; label: string }[] = [
  { label: 'All' },
  { value: 'website', label: 'Sites' },
  { value: 'tweet', label: 'Tweets' },
  { value: 'youtube', label: 'Videos' },
];

export default function MindScreen() {
  const theme = useTheme();
  const view = useMindView();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Kind>();
  const [label, setLabel] = useState<string>();
  const [search, setSearch] = useState('');
  const query = search.trim();
  const labels = useQuery(api.bookmarks.labels, {});
  const paginated = usePaginatedQuery(
    api.bookmarks.list,
    { kind, label },
    { initialNumItems: 24 },
  );
  const searchResults = useQuery(
    api.bookmarks.search,
    query ? { query, kind } : 'skip',
  );

  const items = useMemo(() => {
    const source = query ? (searchResults ?? []) : paginated.results;
    return label
      ? source.filter((bookmark) => bookmark.labels.includes(label))
      : source;
  }, [label, paginated.results, query, searchResults]);

  const contentWidth = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  const columns = view === 'list' ? 1 : width >= 760 ? 3 : 2;
  const gap = view === 'hex' ? 2 : 12;
  const itemWidth =
    view === 'list'
      ? contentWidth
      : Math.floor((contentWidth - gap * (columns - 1)) / columns);
  const firstLoad =
    query && searchResults === undefined
      ? true
      : !query && paginated.status === 'LoadingFirstPage';

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        key={`${view}-${columns}`}
        data={items}
        numColumns={columns}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, view === 'hex' && styles.hexContent]}
        columnWrapperStyle={columns > 1 ? { gap, alignItems: 'flex-start' } : undefined}
        keyExtractor={(bookmark) => bookmark._id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <MindControls
            kind={kind}
            label={label}
            labels={labels ?? []}
            search={search}
            onKind={setKind}
            onLabel={setLabel}
            onSearch={setSearch}
          />
        }
        ListEmptyComponent={
          firstLoad ? (
            <ActivityIndicator style={styles.loading} color={theme.primary} />
          ) : (
            <EmptyMind searching={Boolean(query || kind || label)} />
          )
        }
        ListFooterComponent={
          paginated.status === 'LoadingMore' ? (
            <ActivityIndicator style={styles.footer} color={theme.primary} />
          ) : null
        }
        renderItem={({ item, index }) => (
          <View
            style={
              view === 'hex'
                ? {
                    width: itemWidth,
                    marginTop: index % columns === 0 ? 0 : itemWidth * 0.42,
                    marginBottom: -itemWidth * 0.18,
                  }
                : view === 'cards'
                  ? { width: itemWidth, paddingBottom: gap }
                  : { width: '100%' }
            }
          >
            <BookmarkCell bookmark={item as BookmarkItem} view={view} width={itemWidth} />
          </View>
        )}
        onEndReached={() => {
          if (!query && paginated.status === 'CanLoadMore') paginated.loadMore(24);
        }}
        onEndReachedThreshold={0.5}
      />
    </ThemedView>
  );
}

function MindControls({
  kind,
  label,
  labels,
  search,
  onKind,
  onLabel,
  onSearch,
}: {
  kind?: Kind;
  label?: string;
  labels: { label: string; count: number }[];
  search: string;
  onKind: (kind?: Kind) => void;
  onLabel: (label?: string) => void;
  onSearch: (search: string) => void;
}) {
  const theme = useTheme();
  const view = useMindView();
  return (
    <View style={styles.controls}>
      <View style={styles.headerRow}>
        <ScreenHeader title="Mind" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save a bookmark"
          hitSlop={Spacing.two}
          onPress={() => router.push('/mind/add' as Href)}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.addButtonPressed,
          ]}
        >
          <SymbolView name="plus" size={19} tintColor={theme.primary} />
        </Pressable>
      </View>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name="magnifyingglass" size={17} tintColor={theme.textSecondary} />
        <TextInput
          accessibilityLabel="Search your Mind"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onSearch}
          placeholder="Search your Mind"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.text }]}
          value={search}
        />
        {search ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={Spacing.two}
            onPress={() => onSearch('')}
          >
            <SymbolView name="xmark.circle.fill" size={17} tintColor={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <ViewSwitcher value={view} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {KINDS.map((option) => {
          const selected = option.value === kind;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onKind(option.value)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.secondary : theme.card,
                },
              ]}
            >
              <ThemedText type="smallBold">{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      {labels.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {labels.map((item) => {
            const selected = item.label === label;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onLabel(selected ? undefined : item.label)}
                style={[
                  styles.labelChip,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.secondary : 'transparent',
                  },
                ]}
              >
                <ThemedText type="small">
                  {item.label} {item.count}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function EmptyMind({ searching }: { searching: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyHex}>
        <ThemedText style={styles.emptyGlyph}>⬡</ThemedText>
      </View>
      <ThemedText style={styles.emptyTitle}>
        {searching ? 'Nothing in this corner yet' : 'Give your Mind something to hold'}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyCopy}>
        {searching
          ? 'Try another word, source, or label.'
          : 'Save a useful page, a sharp tweet, or a video worth returning to.'}
      </ThemedText>
      {!searching ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/mind/add' as Href)}
          style={({ pressed }) => [
            styles.emptyAction,
            { backgroundColor: theme.primary },
            pressed && styles.emptyActionPressed,
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.primaryForeground }}>
            Save your first link
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hexContent: { paddingBottom: Spacing.six },
  controls: {
    gap: Spacing.two + Spacing.one,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  addButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three - Spacing.half,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: Spacing.two },
  chips: { gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 15,
  },
  labelChip: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  loading: { paddingTop: 64 },
  footer: { paddingVertical: 28 },
  // Anchored below the controls instead of flexGrow-centered: with the
  // transparent large-title header, flexGrow sizes the container to the full
  // screen and pushes the CTA under the tab bar.
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.five,
  },
  emptyHex: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: '#FFDFB5',
  },
  emptyGlyph: { color: '#8A5410', fontSize: 42 },
  emptyTitle: {
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
    letterSpacing: -0.4,
  },
  emptyCopy: { maxWidth: 320, textAlign: 'center' },
  emptyAction: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: 20,
  },
  emptyActionPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
