import { useRef, useState } from 'react';
import { TaskListCardView } from '@/components/agent/cards/task-list-card';
import { TextScaleContext } from '@/components/text-scale';
import { View } from 'react-native';

import { PreviewGeneratedUI as GeneratedUI } from './preview-generated-ui';

import { BEEUI_COMPONENTS, BEEUI_STACK } from './fixtures';
import { Section, Specimen, useReplySink } from './specimen';

/**
 * Every `beeui` component type, rendered through the real GeneratedUI path so
 * parsing, stagger, and card chrome match production.
 */
export function CardsSection() {
  const reply = useReplySink();

  return (
    <Section
      title="Generated UI (beeui)"
      description="The cards Bee can append to a reply. Interactive cards echo their reply text below the specimen. Web3ConfirmCard is omitted — it needs a live web3Actions document."
    >
      <Specimen
        name="<GeneratedUI>"
        note="A multi-card stack, staggered entrances"
      >
        <View style={{ alignSelf: 'stretch' }}>
          <GeneratedUI components={BEEUI_STACK} onReply={reply.onReply} />
        </View>
      </Specimen>

      {BEEUI_COMPONENTS.map(({ name, component }) => (
        <Specimen key={name} name={`{ type: "${name}" }`}>
          <View style={{ alignSelf: 'stretch' }}>
            <GeneratedUI components={[component]} onReply={reply.onReply} />
          </View>
        </Specimen>
      ))}

      <Specimen
        name="Tasks saving"
        note="Tap a task. Saving takes two seconds; repeated taps are ignored."
      >
        <TaskUpdateExample />
      </Specimen>
      <Specimen
        name="Tasks failed update"
        note="The first update fails locally. Tap again to retry."
      >
        <TaskUpdateExample failFirst />
      </Specimen>
      <Specimen
        name="Tasks large text"
        note="Text at twice its usual size. Also check with device font settings."
      >
        <TextScaleContext.Provider value={2}>
          <TaskUpdateExample />
        </TextScaleContext.Provider>
      </Specimen>
      <Specimen name="Tasks empty">
        <TaskListCardView title="Tasks" items={[]} onToggle={() => {}} />
      </Specimen>
      <Specimen name="Tasks loading">
        <TaskListCardView
          title="Tasks"
          items={[]}
          loading
          onToggle={() => {}}
        />
      </Specimen>

      {reply.sink}
    </Section>
  );
}

function TaskUpdateExample({ failFirst = false }: { failFirst?: boolean }) {
  const [done, setDone] = useState(false);
  const hasFailed = useRef(false);
  return (
    <TaskListCardView
      title="Weekend plans"
      items={[
        {
          id: 'preview-task',
          title:
            'Book the train and send the itinerary to everyone coming this weekend',
          done,
          due: 'Tomorrow',
        },
      ]}
      onToggle={async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (failFirst && !hasFailed.current) {
          hasFailed.current = true;
          throw new Error('Preview failure');
        }
        setDone((value) => !value);
      }}
    />
  );
}
