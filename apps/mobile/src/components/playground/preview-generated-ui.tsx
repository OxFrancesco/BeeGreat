import { useState } from 'react';
import { View } from 'react-native';
import { GeneratedUI } from '@/components/agent/generated-ui';
import { DevinCardView } from '@/components/agent/cards/devin-card';
import { TaskListCardView } from '@/components/agent/cards/task-list-card';
import { FirstFocusPreviewCardView } from '@/components/first-focus/first-focus-preview-card';
import type { UIComponent } from '@/lib/ui-spec';
import { Spacing } from '@/constants/theme';

export function PreviewGeneratedUI({
  components,
  onReply,
}: {
  components: UIComponent[];
  onReply?: (text: string) => void;
}) {
  return (
    <View style={{ gap: Spacing.two, alignSelf: 'stretch' }}>
      {components.map((component, index) => (
        <PreviewCard key={index} component={component} onReply={onReply} />
      ))}
    </View>
  );
}

function PreviewCard({
  component,
  onReply,
}: {
  component: UIComponent;
  onReply?: (text: string) => void;
}) {
  const [items, setItems] = useState(
    component.type === 'tasks' ? component.items : [],
  );
  if (component.type === 'tasks')
    return (
      <TaskListCardView
        title={component.title}
        items={items}
        onToggle={(id) =>
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, done: !item.done } : item,
            ),
          )
        }
      />
    );
  if (component.type === 'devin')
    return <DevinCardView {...component} onReply={onReply} />;
  if (component.type === 'first_focus')
    return (
      <FirstFocusPreviewCardView
        preview={component}
        confirmPlan={async ({ confirmed }) =>
          confirmed
            ? {
                status: 'created',
                bundle: {
                  goalId: 'preview-goal' as never,
                  projectId: 'preview-project' as never,
                  taskId: 'preview-task' as never,
                  highlightId: 'preview-highlight' as never,
                  golieBeeId: 'preview-bee' as never,
                },
              }
            : { status: 'cancelled', bundle: null }
        }
      />
    );
  return <GeneratedUI components={[component]} onReply={onReply} />;
}
