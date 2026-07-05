import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { createContext, type PropsWithChildren, useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * React Native port of the ai-elements Attachments component
 * (https://elements.ai-sdk.dev/components/attachments), matching the file
 * parts produced by the Flue conversation stream.
 */
export interface AttachmentData {
  id: string;
  mediaType: string;
  url?: string;
  filename?: string;
}

export type AttachmentsVariant = 'grid' | 'inline' | 'list';

type MediaKind = 'image' | 'video' | 'audio' | 'document';

export function getMediaKind(mediaType: string): MediaKind {
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('video/')) return 'video';
  if (mediaType.startsWith('audio/')) return 'audio';
  return 'document';
}

const KIND_SYMBOLS = {
  image: 'photo',
  video: 'film',
  audio: 'waveform',
  document: 'doc',
} as const satisfies Record<MediaKind, string>;

const VariantContext = createContext<AttachmentsVariant>('grid');
const ItemContext = createContext<{ data: AttachmentData; onRemove?: () => void } | null>(null);

function useAttachment() {
  const item = useContext(ItemContext);
  if (!item) throw new Error('Attachment subcomponents must render inside <Attachment>.');
  return item;
}

export function Attachments({
  variant = 'grid',
  children,
}: PropsWithChildren<{ variant?: AttachmentsVariant }>) {
  return (
    <VariantContext.Provider value={variant}>
      <View style={variant === 'list' ? styles.list : styles.wrap}>{children}</View>
    </VariantContext.Provider>
  );
}

export function Attachment({
  data,
  onRemove,
  children,
}: PropsWithChildren<{ data: AttachmentData; onRemove?: () => void }>) {
  const variant = useContext(VariantContext);
  const theme = useTheme();
  return (
    <ItemContext.Provider value={{ data, onRemove }}>
      <View
        style={[
          styles.item,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          variant === 'grid' && styles.itemGrid,
          variant === 'inline' && styles.itemInline,
          variant === 'list' && styles.itemList,
        ]}
      >
        {children}
      </View>
    </ItemContext.Provider>
  );
}

export function AttachmentPreview() {
  const { data } = useAttachment();
  const variant = useContext(VariantContext);
  const theme = useTheme();
  const kind = getMediaKind(data.mediaType);
  const size = variant === 'grid' ? 72 : 28;

  if (kind === 'image' && data.url) {
    return (
      <Image
        source={{ uri: data.url }}
        style={{ width: size, height: size, borderRadius: Spacing.one }}
        contentFit="cover"
        accessibilityLabel={data.filename ?? 'Image attachment'}
      />
    );
  }
  return (
    <View style={[styles.iconBox, { width: size, height: size }]}>
      <SymbolView
        name={KIND_SYMBOLS[kind]}
        size={variant === 'grid' ? 28 : 16}
        tintColor={theme.textSecondary}
        fallback={<ThemedText type="small" themeColor="textSecondary">file</ThemedText>}
      />
    </View>
  );
}

export function AttachmentInfo({ showMediaType }: { showMediaType?: boolean }) {
  const { data } = useAttachment();
  return (
    <View style={styles.info}>
      <ThemedText type="small" numberOfLines={1}>
        {data.filename ?? data.mediaType}
      </ThemedText>
      {showMediaType && data.filename ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {data.mediaType}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function AttachmentRemove() {
  const { data, onRemove } = useAttachment();
  const theme = useTheme();
  if (!onRemove) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${data.filename ?? 'attachment'}`}
      onPress={onRemove}
      hitSlop={8}
      style={[styles.remove, { backgroundColor: theme.backgroundSelected }]}
    >
      <SymbolView
        name="xmark"
        size={10}
        tintColor={theme.textSecondary}
        fallback={<ThemedText type="small" themeColor="textSecondary">x</ThemedText>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  item: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    overflow: 'visible',
  },
  itemGrid: {
    padding: Spacing.one,
  },
  itemInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  itemList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flexShrink: 1,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
