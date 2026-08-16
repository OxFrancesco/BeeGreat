import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { FirstFocusPreviewCard } from '@/components/first-focus/first-focus-preview-card';
import { ThemedText } from '@/components/themed-text';
import { MotionDuration } from '@/constants/motion';
import { Spacing } from '@/constants/theme';
import type { UIComponent } from '@/lib/ui-spec';

import { BarChartCard } from './cards/bar-chart-card';
import { BookmarkCard } from './cards/bookmark-card';
import { ConfirmCard } from './cards/confirm-card';
import { DevinCard } from './cards/devin-card';
import { HighlightCard } from './cards/highlight-card';
import { GeneratedImageCard } from './cards/image-card';
import { MetricCard } from './cards/metric-card';
import { QuestionCard } from './cards/question-card';
import { TaskListCard } from './cards/task-list-card';
import { Web3ConfirmCard } from './cards/web3-confirm-card';

/** Renders the agent's `beeui` spec as native cards streaming in below the pill. */
export function GeneratedUI({
  components,
  onReply,
}: {
  components: UIComponent[];
  /** Sends a message back to the agent (used by interactive cards). */
  onReply?: (text: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  if (components.length === 0) return null;
  return (
    <View style={styles.stack}>
      {components.map((component, index) => (
        <Animated.View
          key={index}
          entering={
            reducedMotion
              ? FadeIn.duration(MotionDuration.enter)
              : FadeInDown.delay(index * 80)
                  .springify()
                  .damping(18)
          }
        >
          <UIComponentView component={component} onReply={onReply} />
        </Animated.View>
      ))}
    </View>
  );
}

function UIComponentView({
  component,
  onReply,
}: {
  component: UIComponent;
  onReply?: (text: string) => void;
}) {
  switch (component.type) {
    case 'text':
      return <ThemedText>{component.body}</ThemedText>;
    case 'metric':
      return <MetricCard {...component} />;
    case 'chart':
      return <BarChartCard {...component} />;
    case 'tasks':
      return <TaskListCard {...component} />;
    case 'highlight':
      return <HighlightCard {...component} />;
    case 'image':
      return <GeneratedImageCard {...component} />;
    case 'bookmark':
      return <BookmarkCard {...component} />;
    case 'devin':
      return <DevinCard {...component} onReply={onReply} />;
    case 'first_focus':
      return <FirstFocusPreviewCard preview={component} />;
    case 'confirm': {
      const web3ActionId = component.payload?.web3ActionId;
      if (typeof web3ActionId === 'string' && web3ActionId.length > 0) {
        return (
          <Web3ConfirmCard
            summary={component.summary}
            actionId={web3ActionId}
            onReply={onReply}
          />
        );
      }
      return <ConfirmCard {...component} onReply={onReply} />;
    }
    case 'question':
      return <QuestionCard {...component} onReply={onReply} />;
  }
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
});
