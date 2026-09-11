import { platformSymbol } from '@/components/platform-symbol';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BeeHealthyCardView } from '@/components/bee-healthy/bee-healthy-card';
import { HydrationTracker } from '@/components/bee-healthy/hydration-tracker';
import { JournalCalendar } from '@/components/bee-healthy/journal-calendar';
import { JournalEntryCard } from '@/components/bee-healthy/journal-entry-card';
import { MoodTracker } from '@/components/bee-healthy/mood-tracker';
import { SectionHeader as BeeHealthySectionHeader } from '@/components/bee-healthy/section-header';
import { WeekPulse } from '@/components/bee-healthy/week-pulse';
import {
  GitHubLogo,
  GoogleLogo,
  LinearLogo,
  NotionLogo,
} from '@/components/beennectors/beennector-logos';
import { FirstFocusPreviewCardView } from '@/components/first-focus/first-focus-preview-card';
import { GolieBee } from '@/components/first-focus/golie-bee';
import { HoneyVessel } from '@/components/first-focus/honey-vessel';
import { AddRow } from '@/components/goals/add-row';
import { CombCell } from '@/components/goals/comb-cell';
import { ScreenHeader } from '@/components/goals/screen-header';
import { TaskRow, type TaskItem } from '@/components/goals/task-row';
import { CurrencyBarView } from '@/components/hive/currency-bar';
import { HiveAchievements } from '@/components/hive/hive-achievements';
import { BookmarkCell } from '@/components/mind/bookmark-item';
import { ViewSwitcher } from '@/components/mind/view-switcher';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { localDateKey, type Mood } from '@/lib/bee-healthy';
import type { MindView } from '@/lib/preferences';
import { useTheme } from '@/hooks/use-theme';

import {
  ACHIEVEMENTS,
  BOOKMARKS,
  CURRENCIES,
  JOURNAL_ENTRY,
  JOURNAL_MONTH_DAYS,
  WEEK_PULSE,
} from './fixtures';
import {
  Section,
  Specimen,
  useReplySink,
  Variant,
  VariantRow,
} from './specimen';

const TASKS: {
  label: string;
  task: TaskItem;
  isSubtask?: boolean;
  highlighted?: boolean;
}[] = [
  {
    label: 'todo',
    task: {
      id: 'fixture-1',
      title: 'Draft the release notes',
      status: 'todo',
      dueDate: Date.now() + 86_400_000,
      labels: ['launch'],
    },
  },
  {
    label: 'done',
    task: {
      id: 'fixture-2',
      title: 'Wire the playground route',
      status: 'done',
      dueDate: null,
      labels: [],
    },
  },
  {
    label: 'subtask',
    isSubtask: true,
    task: {
      id: 'fixture-3',
      title: 'Polish the spacing scale',
      status: 'todo',
      dueDate: Date.now() - 86_400_000,
      labels: [],
    },
  },
  {
    label: 'highlighted',
    highlighted: true,
    task: {
      id: 'fixture-4',
      title: 'First focus for today',
      status: 'todo',
      dueDate: Date.now(),
      labels: ['focus'],
    },
  },
];

export function DomainsSection() {
  const reply = useReplySink();
  const theme = useTheme();
  const [tasks, setTasks] = useState(TASKS);
  const [mood, setMood] = useState<Mood | null>('good');
  const [waterMl, setWaterMl] = useState(1_250);
  const [mindView, setMindView] = useState<MindView>('cards');
  const [celebrating, setCelebrating] = useState(false);
  const monthStart = `${localDateKey().slice(0, 8)}01`;

  return (
    <Section
      title="Domain components"
      description="Goals, Mind, Hive, Bee Healthy, and first-focus pieces. Tapping a bookmark or journal card navigates to its real screen."
    >
      <Specimen name="<ScreenHeader>">
        <View style={{ alignSelf: 'stretch', gap: Spacing.two }}>
          <ScreenHeader title="Goals" />
          <ScreenHeader
            title="Marathon training"
            showBack
            right={<ThemedText type="smallBold">Edit</ThemedText>}
          />
        </View>
      </Specimen>

      <Specimen name="<TaskRow>">
        <View style={{ alignSelf: 'stretch', gap: Spacing.two }}>
          {tasks.map(({ label, task, isSubtask, highlighted }) => (
            <View key={task.id}>
              <ThemedText type="code" themeColor="textSecondary">
                {label}
              </ThemedText>
              <TaskRow
                task={task}
                isSubtask={isSubtask}
                highlighted={highlighted}
                onToggle={() =>
                  setTasks((current) =>
                    current.map((item) =>
                      item.task.id === task.id
                        ? {
                            ...item,
                            task: {
                              ...item.task,
                              status:
                                item.task.status === 'done' ? 'todo' : 'done',
                            },
                          }
                        : item,
                    ),
                  )
                }
                onLongPress={() => {}}
                onAddSubtask={isSubtask ? undefined : () => {}}
              />
            </View>
          ))}
        </View>
      </Specimen>

      <Specimen name="<CombCell>">
        <VariantRow>
          {[0, 0.35, 0.75, 1].map((progress) => (
            <Variant key={progress} label={`${progress * 100}%`}>
              <CombCell size={64} progress={progress} />
            </Variant>
          ))}
        </VariantRow>
      </Specimen>

      <Specimen name="<AddRow>" note="Tap to open the input">
        <View style={{ alignSelf: 'stretch', gap: Spacing.two }}>
          <AddRow label="Add a task" onSubmit={reply.onReply} />
          <AddRow
            label="Subtask"
            compact
            startActive={false}
            onSubmit={reply.onReply}
          />
        </View>
      </Specimen>

      <Specimen name="<ViewSwitcher>" note="Switch between view variants">
        <ViewSwitcher value={mindView} onChange={setMindView} />
      </Specimen>

      <Specimen name="<BookmarkCell>" note="Bookmark layout variants">
        <View style={{ alignSelf: 'stretch', gap: Spacing.two }}>
          <ViewSwitcher value={mindView} onChange={setMindView} />
          {mindView === 'hex' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {BOOKMARKS.map((bookmark) => (
                <BookmarkCell
                  onPress={() => reply.onReply('Open bookmark preview')}
                  key={bookmark._id}
                  bookmark={bookmark}
                  view="hex"
                  width={110}
                />
              ))}
            </View>
          ) : (
            BOOKMARKS.map((bookmark) => (
              <BookmarkCell
                onPress={() => reply.onReply('Open bookmark preview')}
                key={bookmark._id}
                bookmark={bookmark}
                view={mindView}
                width={160}
              />
            ))
          )}
        </View>
      </Specimen>

      <Specimen name="<CurrencyBarView>">
        <View style={{ alignSelf: 'stretch', gap: Spacing.two }}>
          <CurrencyBarView values={CURRENCIES} />
          <CurrencyBarView values={CURRENCIES} size="regular" />
        </View>
      </Specimen>

      <Specimen name="<HoneyVessel>">
        <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <HoneyVessel balance={62} />
        </View>
      </Specimen>

      <Specimen name="<HiveAchievements>">
        <View style={{ alignSelf: 'stretch' }}>
          <HiveAchievements achievements={ACHIEVEMENTS} />
        </View>
      </Specimen>

      <Specimen name="<BeeHealthySectionHeader>">
        <View style={{ alignSelf: 'stretch' }}>
          <BeeHealthySectionHeader
            title="Mood"
            subtitle="Tuesday, September 9"
            actions={
              <SymbolView
                name={platformSymbol("calendar")}
                size={18}
                tintColor={theme.textSecondary}
              />
            }
          />
        </View>
      </Specimen>

      <Specimen name="<MoodTracker>" note="Live — pick a mood">
        <View style={{ alignSelf: 'stretch' }}>
          <MoodTracker value={mood} onChange={setMood} />
        </View>
      </Specimen>

      <Specimen name="<HydrationTracker>" note="Live — the bottle fills">
        <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <HydrationTracker
            valueMl={waterMl}
            goalMl={2_000}
            onAdd={(amount) => setWaterMl((ml) => ml + amount)}
            onRemove={(amount) => setWaterMl((ml) => Math.max(0, ml - amount))}
          />
        </View>
      </Specimen>

      <Specimen name="<WeekPulse>">
        <WeekPulse today={new Date()} entries={WEEK_PULSE} />
      </Specimen>

      <Specimen name="<BeeHealthyCardView>">
        <View style={{ alignSelf: 'stretch' }}>
          <BeeHealthyCardView summary="Solid week — four good-or-better days and water on track." />
        </View>
      </Specimen>

      <Specimen name="<JournalCalendar>">
        <View style={{ alignSelf: 'stretch' }}>
          <JournalCalendar
            monthStart={monthStart}
            days={JOURNAL_MONTH_DAYS}
            selectedDate={localDateKey()}
            today={localDateKey()}
            onChangeMonth={() => {}}
            onSelectDate={() => {}}
          />
        </View>
      </Specimen>

      <Specimen name="<JournalEntryCard>">
        <View style={{ alignSelf: 'stretch' }}>
          <JournalEntryCard
            onPress={() => reply.onReply('Open journal preview')}
            entry={JOURNAL_ENTRY}
            onDelete={() => {}}
            onToggleFavorite={() => {}}
            onTogglePinned={() => {}}
          />
        </View>
      </Specimen>

      <Specimen name="<GolieBee>" note="Toggle celebration">
        <View style={{ gap: Spacing.two }}>
          <VariantRow>
            <Variant label="seed: alph">
              <GolieBee seed="alph" />
            </Variant>
            <Variant label="seed: bravo, compact">
              <GolieBee seed="bravo" compact />
            </Variant>
            <Variant label={celebrating ? 'celebrating' : 'idle'}>
              <Pressable onPress={() => setCelebrating((value) => !value)}>
                <GolieBee seed="charlie" celebrating={celebrating} />
              </Pressable>
            </Variant>
          </VariantRow>
        </View>
      </Specimen>

      <Specimen
        name="<FirstFocusPreviewCardView>"
        note="Pure view; confirm is stubbed to 'created', so the card flips to its saved state"
      >
        <View style={{ alignSelf: 'stretch' }}>
          <FirstFocusPreviewCardView
            preview={{
              type: 'first_focus',
              requestId: 'playground-request',
              goalTitle: 'Ship BeeGreat 1.0',
              projectTitle: 'Chat interface',
              taskTitle: 'Component playground page',
            }}
            confirmPlan={async ({ confirmed }) => confirmed ? ({
              status: 'created' as const,
              bundle: {
                goalId: 'playground-goal' as never,
                projectId: 'playground-project' as never,
                taskId: 'playground-task' as never,
                highlightId: 'playground-highlight' as never,
                golieBeeId: 'playground-golie' as never,
              },
            }) : ({ status: 'cancelled', bundle: null })}
          />
        </View>
      </Specimen>

      <Specimen name="Beennector logos">
        <VariantRow>
          <Variant label="GitHub">
            <View style={[styles.logoTile, { backgroundColor: '#1B1F23' }]}>
              <GitHubLogo size={20} />
            </View>
          </Variant>
          <Variant label="Linear">
            <View style={[styles.logoTile, { backgroundColor: '#5E6AD2' }]}>
              <LinearLogo size={20} />
            </View>
          </Variant>
          <Variant label="Notion">
            <View style={[styles.logoTile, { backgroundColor: theme.card }]}>
              <NotionLogo size={20} />
            </View>
          </Variant>
          <Variant label="Google">
            <View style={[styles.logoTile, { backgroundColor: theme.card }]}>
              <GoogleLogo size={20} />
            </View>
          </Variant>
        </VariantRow>
      </Specimen>
      {reply.sink}
    </Section>
  );
}

const styles = StyleSheet.create({
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
