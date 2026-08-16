import { bookmarkHost } from '@beegreat/tool-presentation';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as Linking from 'expo-linking';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UIComponent } from '@/lib/ui-spec';

import { sharedStyles } from './shared';

export function BookmarkCard({
  title,
  url,
  note,
}: Extract<UIComponent, { type: 'bookmark' }>) {
  const theme = useTheme();
  const host = bookmarkHost(url);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open bookmark ${title} on ${host}`}
      onPress={() => {
        Haptics.selectionAsync();
        void Linking.openURL(url);
      }}
      style={({ pressed }) => [
        sharedStyles.card,
        styles.bookmarkCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        pressed && sharedStyles.taskRowPressed,
      ]}
    >
      <View style={styles.bookmarkHeading}>
        <ExpoImage
          accessibilityElementsHidden
          importantForAccessibility="no"
          contentFit="contain"
          source={{
            uri: `https://www.google.com/s2/favicons?domain=${host}&sz=64`,
          }}
          style={[
            styles.bookmarkFavicon,
            { backgroundColor: theme.backgroundElement },
          ]}
        />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          style={styles.bookmarkTitle}
        >
          {title}
        </ThemedText>
        <SymbolView
          name="arrow.up.right"
          size={13}
          tintColor={theme.textSecondary}
          fallback={
            <ThemedText type="small" themeColor="textSecondary">
              ↗
            </ThemedText>
          }
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
        {note?.trim() || host}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bookmarkCard: {
    gap: Spacing.two,
  },
  bookmarkHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bookmarkFavicon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  bookmarkTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
  },
});
