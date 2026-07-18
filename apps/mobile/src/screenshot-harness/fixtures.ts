import { api } from '@beegreat/backend/convex/_generated/api';
import type {
  Id,
  TableNames,
} from '@beegreat/backend/convex/_generated/dataModel';
import type { FlueConversationMessage } from '@flue/react';
import type { FunctionReturnType } from 'convex/server';

import type { BookmarkItem } from '@/components/mind/bookmark-item';
import {
  SCREENSHOT_SHOTS,
  isScreenshotShot,
  type ScreenshotAgentState,
  type ScreenshotShot,
} from '@/lib/screenshot-fixture';

export { SCREENSHOT_SHOTS, isScreenshotShot, type ScreenshotShot };

export const SCREENSHOT_HEADLINES: Record<ScreenshotShot, string> = {
  'bee-focus': 'Turn goals into your next step',
  'goals-plan': 'Know exactly what to do next',
  'hive-progress': 'Make focused progress visible',
  'voice-with-bee': 'Talk it through with Bee',
  'mind-bookmarks': 'Keep useful ideas close',
};

type ScreenshotStoryTask = {
  title: string;
  done: boolean;
  highlight?: boolean;
};

export const SCREENSHOT_STORY: {
  goal: string;
  finalGoal: string;
  project: string;
  tasks: ScreenshotStoryTask[];
  honey: number;
  honeycombScore: number;
  royalJelly: number;
} = {
  goal: 'Build calmer mornings',
  finalGoal: 'Start work feeling clear, prepared, and unhurried.',
  project: 'Weekday morning routine',
  tasks: [
    { title: 'Prepare breakfast the night before', done: true },
    { title: 'Start with a 10-minute stretch', done: false, highlight: true },
    { title: 'Review the routine after one week', done: false },
  ],
  honey: 68,
  honeycombScore: 240,
  royalJelly: 3,
};

const fixtureId = <TableName extends TableNames>(value: string) =>
  value as Id<TableName>;

const GOAL_ID = fixtureId<'goals'>('fixture_goal');
const PROJECT_ID = fixtureId<'projects'>('fixture_project');
const TASK_IDS = [
  fixtureId<'tasks'>('fixture_task_prepare'),
  fixtureId<'tasks'>('fixture_task_stretch'),
  fixtureId<'tasks'>('fixture_task_review'),
] as const;
const HIGHLIGHT_ID = fixtureId<'highlights'>('fixture_highlight');
const GOLIE_BEE_ID = fixtureId<'golieBees'>('fixture_golie_bee');
const PROGRESS_ID = fixtureId<'verifiedProgressEvents'>('fixture_progress');
const BOOKMARK_IDS = [
  fixtureId<'bookmarks'>('fixture_bookmark_guide'),
  fixtureId<'bookmarks'>('fixture_bookmark_notes'),
  fixtureId<'bookmarks'>('fixture_bookmark_video'),
] as const;

const FIXTURE_TIMESTAMP = Date.UTC(2026, 6, 16, 7, 41);
const HIGHLIGHT_EXPIRES_AT = Date.UTC(2026, 6, 17, 21, 59);

export const SCREENSHOT_PROJECT = {
  id: PROJECT_ID,
  title: SCREENSHOT_STORY.project,
  status: 'active' as const,
  due: { year: 2026, quarter: 3 },
  beeImageUrl: null,
  goalId: GOAL_ID,
  goalTitle: SCREENSHOT_STORY.goal,
} satisfies NonNullable<FunctionReturnType<typeof api.projects.get>>;

export const SCREENSHOT_GOALS = [
  {
    id: GOAL_ID,
    title: SCREENSHOT_STORY.goal,
    finalGoal: SCREENSHOT_STORY.finalGoal,
    projectCount: 1,
    openTasks: 2,
    doneTasks: 1,
  },
] satisfies FunctionReturnType<typeof api.goals.list>;

export const SCREENSHOT_TASKS = SCREENSHOT_STORY.tasks.map((task, index) => ({
  id: TASK_IDS[index]!,
  title: task.title,
  status: task.done ? ('done' as const) : ('todo' as const),
  parentTaskId: null,
  labels: task.highlight ? ['Highlight'] : [],
  dueDate: task.highlight ? HIGHLIGHT_EXPIRES_AT : null,
  completedAt: task.done ? FIXTURE_TIMESTAMP - 3_600_000 : null,
})) satisfies FunctionReturnType<typeof api.tasks.listByProject>;

export const SCREENSHOT_HIVE = {
  hive: {
    honeyBalance: SCREENSHOT_STORY.honey,
    honeycombScore: SCREENSHOT_STORY.honeycombScore,
    royalJellyBalance: SCREENSHOT_STORY.royalJelly,
  },
  activeGoals: [
    {
      goalId: GOAL_ID,
      title: SCREENSHOT_STORY.goal,
      finalGoal: SCREENSHOT_STORY.finalGoal,
      golieBee: {
        golieBeeId: GOLIE_BEE_ID,
        seed: 'calmer-mornings-golie-bee',
        variant: 'mvp-default' as const,
        status: 'active' as const,
      },
    },
  ],
  activeHighlight: {
    highlightId: HIGHLIGHT_ID,
    goalId: GOAL_ID,
    projectId: PROJECT_ID,
    taskId: TASK_IDS[1],
    title: SCREENSHOT_STORY.tasks[1]!.title,
    expiresAt: HIGHLIGHT_EXPIRES_AT,
  },
  latestVerifiedProgress: {
    eventId: PROGRESS_ID,
    goalId: GOAL_ID,
    taskId: TASK_IDS[0],
    occurredAt: FIXTURE_TIMESTAMP - 3_600_000,
    honeyDelta: 12,
    scoreDelta: 40,
  },
  economy: {
    royalJellyBalance: SCREENSHOT_STORY.royalJelly,
    brainFatigue: {
      isActive: false,
      dailyHoneyDrain: 0,
      rank: 0,
      affectedGoalCount: 0,
    },
    geniusState: {
      isActive: false,
      verifiedGoalCount: 1,
      requiredGoalCount: 3,
    },
    activeFocusShield: null,
    weeklyProgress: {
      startedAt: FIXTURE_TIMESTAMP - 2 * 86_400_000,
      endsAt: FIXTURE_TIMESTAMP + 5 * 86_400_000,
      completedGoals: 0,
      requiredGoals: 1,
      completed: false,
    },
    achievements: [
      {
        id: `${GOAL_ID}:tasks:1`,
        title: 'Busy Bee',
        rank: 1,
        kind: 'goliebee' as const,
      },
    ],
  },
} satisfies FunctionReturnType<typeof api.firstFocus.getCurrent>;

export const SCREENSHOT_HIVE_COMPLETION = {
  result: {
    status: 'completed' as const,
    taskId: TASK_IDS[0],
    honeyAwarded: 12,
    scoreAwarded: 40,
    honeyBalance: SCREENSHOT_STORY.honey,
    honeycombScore: SCREENSHOT_STORY.honeycombScore,
  },
  goal: SCREENSHOT_HIVE.activeGoals[0],
  highlightTitle: SCREENSHOT_STORY.tasks[0]!.title,
};

const beeFocusMessages: FlueConversationMessage[] = [
  {
    id: 'fixture_bee_focus_user',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'Help me build a calmer morning routine before work.',
        state: 'done',
      },
    ],
  },
  {
    id: 'fixture_bee_focus_assistant',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        state: 'done',
        text:
          'Let’s turn that into one clear first focus. You can edit every part before it is saved.\n```beeui\n' +
          JSON.stringify({
            components: [
              {
                type: 'first_focus',
                requestId: 'fixture-first-focus',
                goalTitle: SCREENSHOT_STORY.goal,
                projectTitle: SCREENSHOT_STORY.project,
                taskTitle: SCREENSHOT_STORY.tasks[1]!.title,
                seed: 'calmer-mornings-golie-bee',
                highlightExpiresAt: HIGHLIGHT_EXPIRES_AT,
              },
            ],
          }) +
          '\n```',
      },
    ],
  },
];

const voiceMessages: FlueConversationMessage[] = [
  {
    id: 'fixture_voice_user',
    role: 'user',
    parts: [
      {
        type: 'text',
        text: 'Can we make tomorrow’s Highlight feel easier?',
        state: 'done',
      },
    ],
  },
  {
    id: 'fixture_voice_assistant',
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'Absolutely. Prepare one thing tonight, then tomorrow’s ten-minute stretch is the only step to start.',
        state: 'done',
      },
    ],
  },
];

export function screenshotAgent(shot: ScreenshotShot): ScreenshotAgentState {
  return {
    messages: shot === 'voice-with-bee' ? voiceMessages : beeFocusMessages,
    busy: false,
    recording: shot === 'voice-with-bee',
    errorMessage: undefined,
    sendText: () => {},
  };
}

export const SCREENSHOT_BOOKMARKS: BookmarkItem[] = [
  {
    _id: BOOKMARK_IDS[0],
    _creationTime: FIXTURE_TIMESTAMP - 3 * 86_400_000,
    url: 'https://fieldnotes.example/calmer-mornings',
    kind: 'website',
    status: 'ready',
    title: 'A practical guide to calmer mornings',
    summary: 'Small evening preparations that make the next morning feel lighter.',
    labels: ['Routines', 'Wellbeing'],
    note: undefined,
    meta: undefined,
    transcriptSource: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    retryCount: 0,
    createdAt: FIXTURE_TIMESTAMP - 3 * 86_400_000,
    updatedAt: FIXTURE_TIMESTAMP - 3 * 86_400_000,
  },
  {
    _id: BOOKMARK_IDS[1],
    _creationTime: FIXTURE_TIMESTAMP - 2 * 86_400_000,
    url: 'https://studio.example/ten-minute-reset',
    kind: 'website',
    status: 'ready',
    title: 'The ten-minute reset',
    summary: 'A short sequence for starting work with a clear head.',
    labels: ['Focus', 'Routines'],
    note: undefined,
    meta: undefined,
    transcriptSource: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    retryCount: 0,
    createdAt: FIXTURE_TIMESTAMP - 2 * 86_400_000,
    updatedAt: FIXTURE_TIMESTAMP - 2 * 86_400_000,
  },
  {
    _id: BOOKMARK_IDS[2],
    _creationTime: FIXTURE_TIMESTAMP - 86_400_000,
    url: 'https://watch.example/easy-stretch',
    kind: 'youtube',
    status: 'ready',
    title: 'An easy stretch before work',
    summary: 'A gentle routine that fits into ten unhurried minutes.',
    labels: ['Wellbeing'],
    note: undefined,
    meta: undefined,
    transcriptSource: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    retryCount: 0,
    createdAt: FIXTURE_TIMESTAMP - 86_400_000,
    updatedAt: FIXTURE_TIMESTAMP - 86_400_000,
  },
];

export const SCREENSHOT_BOOKMARK_LABELS = [
  { label: 'Routines', count: 2 },
  { label: 'Wellbeing', count: 2 },
  { label: 'Focus', count: 1 },
];

export const FIXTURE_PRIVACY_ASSERTIONS = [
  'All story text is fictional and authored for BeeGreat.',
  'No email address, account name, health record, workspace, or notification is rendered.',
  'Bookmark sources use the reserved .example top-level domain.',
  'The harness never connects to Clerk, Convex, Flue, RevenueCat, or StoreKit.',
] as const;
