import { type PropsWithChildren, useCallback, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';

/**
 * Auto-following conversation scroller (React Native port of the
 * ai-elements Conversation component): sticks to the bottom while content
 * streams in, releases when the user scrolls up.
 */
export function Conversation({
  children,
  contentContainerStyle,
}: PropsWithChildren<{ contentContainerStyle?: ViewStyle }>) {
  const scrollRef = useRef<ScrollView>(null);
  const following = useRef(true);
  const userIsDragging = useRef(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!userIsDragging.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    following.current = distanceFromBottom < 80;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (!following.current) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      onScrollBeginDrag={() => {
        userIsDragging.current = true;
      }}
      onScrollEndDrag={(event) => {
        handleScroll(event);
        userIsDragging.current = false;
      }}
      onMomentumScrollEnd={(event) => {
        userIsDragging.current = true;
        handleScroll(event);
        userIsDragging.current = false;
      }}
      scrollEventThrottle={32}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
});
