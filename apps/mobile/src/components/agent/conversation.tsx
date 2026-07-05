import { type PropsWithChildren, useCallback, useRef, useState } from 'react';
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
  const [following, setFollowing] = useState(true);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setFollowing(distanceFromBottom < 80);
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (following) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [following]);

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEventThrottle={64}
      onContentSizeChange={handleContentSizeChange}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardDismissMode="interactive"
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
    paddingVertical: Spacing.three,
  },
});
