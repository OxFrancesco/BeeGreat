import type {
  LegendListRef,
  LegendListRenderItemProps,
} from '@legendapp/list/react-native';
import {
  KeyboardAwareLegendList,
  useKeyboardChatComposerInset,
  useKeyboardScrollToEnd,
} from '@legendapp/list/keyboard';
import {
  type ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

const MAINTAIN_AT_END = {
  animated: false,
  on: {
    dataChange: true,
    footerLayout: true,
    itemLayout: true,
    layout: true,
  },
} as const;

const MAINTAIN_VISIBLE_POSITION = {
  data: true,
  size: true,
} as const;

type ConversationProps<ItemT> = {
  data: ItemT[];
  dataKey: string | number;
  keyExtractor: (item: ItemT, index: number) => string;
  renderItem: (props: LegendListRenderItemProps<ItemT>) => ReactElement | null;
  getItemType?: (item: ItemT, index: number) => string;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  contentContainerStyle?: ViewStyle;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void | Promise<void>;
  onSubmit: (text: string) => void | Promise<void>;
  renderComposer: (onSubmit: (text: string) => Promise<void>) => ReactElement;
};

/**
 * Virtualized, keyboard-aware conversation surface.
 *
 * Legend List measures the variable-height reasoning, tool, text, and generated
 * UI rows. Its end-maintenance follows streaming output only while the reader is
 * near the latest message, so scrolling up releases auto-follow naturally.
 */
export function Conversation<ItemT>({
  data,
  dataKey,
  keyExtractor,
  renderItem,
  getItemType,
  header,
  footer,
  contentContainerStyle,
  canLoadOlder = false,
  loadingOlder = false,
  onLoadOlder,
  onSubmit,
  renderComposer,
}: ConversationProps<ItemT>) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<LegendListRef>(null);
  const composerRef = useRef<View>(null);
  const [anchorIndex, setAnchorIndex] = useState<number>();
  const { contentInsetEndAdjustment, onComposerLayout } =
    useKeyboardChatComposerInset(listRef, composerRef, 64);
  const { freeze, scrollMessageToEnd } = useKeyboardScrollToEnd({ listRef });

  const submit = useCallback(
    async (text: string) => {
      const isNewThreadCommand = /^\/(?:clear|new)\s*$/i.test(text);
      setAnchorIndex(isNewThreadCommand ? undefined : data.length);

      try {
        const submission = onSubmit(text);

        // The agent appends the outgoing message optimistically. Wait one frame
        // for that row to commit, then coordinate keyboard dismissal and the
        // end scroll on the UI thread.
        requestAnimationFrame(() => {
          void scrollMessageToEnd({ animated: true, closeKeyboard: true });
        });

        await submission;
      } catch (error) {
        setAnchorIndex(undefined);
        throw error;
      }
    },
    [data.length, onSubmit, scrollMessageToEnd],
  );

  const anchoredEndSpace = useMemo(
    () =>
      anchorIndex !== undefined && anchorIndex < data.length
        ? {
            anchorIndex,
            anchorOffset: Spacing.two,
          }
        : undefined,
    [anchorIndex, data.length],
  );

  const loadOlder = useCallback(() => {
    if (!canLoadOlder || loadingOlder || !onLoadOlder) return;
    void onLoadOlder();
  }, [canLoadOlder, loadingOlder, onLoadOlder]);

  return (
    <>
      <KeyboardAwareLegendList
        ref={listRef}
        alignItemsAtEnd
        anchoredEndSpace={anchoredEndSpace}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        contentInsetAdjustmentBehavior="automatic"
        contentInsetEndAdjustment={contentInsetEndAdjustment}
        data={data}
        dataKey={dataKey}
        freeze={freeze}
        getItemType={getItemType}
        initialScrollAtEnd
        keyboardDismissMode="interactive"
        keyboardOffset={insets.bottom}
        keyboardShouldPersistTaps="handled"
        keyExtractor={keyExtractor}
        ListHeaderComponent={header ?? null}
        ListFooterComponent={footer ?? null}
        maintainScrollAtEnd={MAINTAIN_AT_END}
        maintainScrollAtEndThreshold={0.15}
        maintainVisibleContentPosition={MAINTAIN_VISIBLE_POSITION}
        onStartReached={canLoadOlder ? loadOlder : undefined}
        onStartReachedThreshold={0.25}
        recycleItems={false}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View ref={composerRef} onLayout={onComposerLayout}>
          {renderComposer(submit)}
        </View>
      </KeyboardStickyView>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
});
