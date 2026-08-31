import { api } from '@beegreat/backend/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { Image as ExpoImage } from 'expo-image';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MOODS } from '@/lib/bee-healthy';
import { journalShareText } from '@/lib/journal-share';

export type JournalTimelineEntry = FunctionReturnType<
  typeof api.journalEntries.listRecent
>[number];

type HealthEntry = FunctionReturnType<typeof api.healthJournal.listRecent>[number];

export function JournalEntryCard({
  entry,
  health,
  onDelete,
  onToggleFavorite,
  onTogglePinned,
}: {
  entry: JournalTimelineEntry;
  health?: HealthEntry;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onTogglePinned: () => void;
}) {
  const theme = useTheme();
  const href = {
    pathname: '/journal-entry/[entryId]' as const,
    params: { entryId: entry.id },
  };
  const mood = health?.mood
    ? MOODS.find((option) => option.value === health.mood)
    : null;
  const body = entry.body.trim();
  const hasWrittenTitle = entry.title.trim().length > 0;
  const title = hasWrittenTitle ? entry.title.trim() : firstMeaningfulLine(body);
  const excerpt = hasWrittenTitle ? body : bodyAfterFirstLine(body);

  return (
    <Link href={href} asChild>
      <Link.Trigger>
        <Pressable
          accessibilityHint="Opens this journal entry"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.topRow}>
            <ThemedText selectable type="small" themeColor="textSecondary">
              {formatEntryTime(entry.occurredAt)}
            </ThemedText>
            <View style={styles.flags}>
              {entry.isPinned ? (
                <SymbolView
                  name="pin.fill"
                  size={13}
                  tintColor={theme.primary}
                  fallback={<ThemedText type="small">Pinned</ThemedText>}
                />
              ) : null}
              {entry.isFavorite ? (
                <SymbolView
                  name="heart.fill"
                  size={13}
                  tintColor={theme.primary}
                  fallback={<ThemedText type="small">Favorite</ThemedText>}
                />
              ) : null}
            </View>
          </View>

          {entry.coverPhoto ? (
            <ExpoImage
              accessibilityLabel={entry.coverPhoto.fileName ?? 'Journal photo'}
              contentFit="cover"
              source={{ uri: entry.coverPhoto.url }}
              style={styles.photo}
              transition={160}
            />
          ) : null}

          <View style={styles.copy}>
            <ThemedText selectable style={styles.title} numberOfLines={2}>
              {title || (entry.coverPhoto ? 'Photo memory' : 'Untitled entry')}
            </ThemedText>
            {excerpt ? (
              <ThemedText
                selectable
                style={styles.excerpt}
                themeColor="textSecondary"
                numberOfLines={3}
              >
                {excerpt}
              </ThemedText>
            ) : null}
          </View>

          {entry.tags.length ? (
            <View style={styles.tags}>
              {entry.tags.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  style={[styles.tag, { backgroundColor: theme.backgroundElement }]}
                >
                  <ThemedText style={styles.tagText} themeColor="textSecondary">
                    #{tag}
                  </ThemedText>
                </View>
              ))}
              {entry.tags.length > 3 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  +{entry.tags.length - 3}
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {mood || (health?.hydrationMl ?? 0) > 0 ? (
            <View style={styles.metadata}>
              {mood ? (
                <View style={[styles.chip, { backgroundColor: mood.softColor }]}>
                  <ThemedText style={[styles.chipText, { color: '#3D322B' }]}>
                    {mood.label}
                  </ThemedText>
                </View>
              ) : null}
              {(health?.hydrationMl ?? 0) > 0 ? (
                <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <SymbolView
                    name="drop.fill"
                    size={12}
                    tintColor="#2F8795"
                    fallback={<ThemedText type="small">Water</ThemedText>}
                  />
                  <ThemedText style={styles.chipText} themeColor="textSecondary">
                    {health!.hydrationMl.toLocaleString()} ml
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        <Link.MenuAction
          title={entry.isPinned ? 'Unpin' : 'Pin'}
          icon={entry.isPinned ? 'pin.slash' : 'pin'}
          onPress={onTogglePinned}
        />
        <Link.MenuAction
          title={entry.isFavorite ? 'Remove Favorite' : 'Favorite'}
          icon={entry.isFavorite ? 'heart.slash' : 'heart'}
          onPress={onToggleFavorite}
        />
        <Link.MenuAction
          title="Share"
          icon="square.and.arrow.up"
          onPress={() => {
            void Share.share({ message: journalShareText(entry) });
          }}
        />
        <Link.MenuAction title="Delete" icon="trash" destructive onPress={onDelete} />
      </Link.Menu>
      <Link.Preview />
    </Link>
  );
}

function firstMeaningfulLine(body: string) {
  return body.split(/\n+/).find((line) => line.trim())?.trim() ?? '';
}

function bodyAfterFirstLine(body: string) {
  const lines = body.split(/\n+/).filter((line) => line.trim());
  return lines.slice(1).join(' ').trim();
}

function formatEntryTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  topRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  flags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: {
    gap: Spacing.one,
  },
  photo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#EFEFEF',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
  excerpt: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: 500,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    minHeight: 26,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 700,
  },
  chip: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
