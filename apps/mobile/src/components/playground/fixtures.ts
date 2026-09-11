import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import type { FlueConversationMessage } from '@flue/react';

import type { AttachmentData } from '@/components/agent/attachments';
import type { AchievementSummary } from '@/components/hive/hive-achievements';
import type { WeekPulseEntry } from '@/components/bee-healthy/week-pulse';
import type { JournalMonthDay } from '@/components/bee-healthy/journal-calendar';
import type { BookmarkItem } from '@/components/mind/bookmark-item';
import type { JournalTimelineEntry } from '@/components/bee-healthy/journal-entry-card';
import { localDateKey } from '@/lib/bee-healthy';
import type { UIComponent } from '@/lib/ui-spec';

/**
 * Fixture data for the playground. Tweak values here and Fast Refresh
 * updates every specimen that uses them.
 */

export const MARKDOWN_SAMPLE = [
  'Here is the **shape** of your week — three things stand out.',
  '',
  '## The plan',
  '1. Ship the component playground',
  '2. Review `extractBeeUI` edge cases',
  '3. Book flights for the offsite',
  '',
  '> Done is better than perfect.',
  '',
  'Inline `code`, a [link to Expo](https://expo.dev), and a table:',
  '',
  '| Task | Effort |',
  '| ---- | ------ |',
  '| Gallery | M |',
  '| Polish | S |',
].join('\n');

export const BEEUI_STACK: UIComponent[] = [
  {
    type: 'text',
    body: 'A short written note that did not fit the spoken reply.',
  },
  {
    type: 'metric',
    label: 'Focus streak',
    value: '12 days',
    delta: '+2 this week',
  },
  {
    type: 'chart',
    kind: 'bar',
    title: 'Deep work hours',
    unit: 'h',
    data: [
      { label: 'Mon', value: 3.5 },
      { label: 'Tue', value: 5 },
      { label: 'Wed', value: 2 },
      { label: 'Thu', value: 6.5 },
    ],
  },
];

export const BEEUI_COMPONENTS: { name: string; component: UIComponent }[] = [
  {
    name: 'text',
    component: {
      type: 'text',
      body: 'A short written note that did not fit the spoken reply.',
    },
  },
  {
    name: 'metric',
    component: {
      type: 'metric',
      label: 'Honey balance',
      value: '68',
      delta: '+12 today',
    },
  },
  {
    name: 'chart',
    component: {
      type: 'chart',
      kind: 'bar',
      title: 'Tasks completed per goal',
      unit: 'tasks',
      data: [
        { label: 'BeeGreat', value: 8 },
        { label: 'Marathon', value: 3 },
        { label: 'Reading', value: 5 },
      ],
    },
  },
  {
    name: 'tasks',
    component: {
      type: 'tasks',
      title: 'Launch checklist',
      items: [
        {
          id: 'fixture-task-1',
          title: 'Draft release notes',
          done: true,
          due: 'Today',
        },
        {
          id: 'fixture-task-2',
          title: 'Record demo video',
          done: false,
          due: 'Tomorrow',
        },
        { id: 'fixture-task-3', title: 'Tag the release', done: false },
      ],
    },
  },
  {
    name: 'highlight',
    component: {
      type: 'highlight',
      title: 'The one thing',
      body: 'If nothing else moves today, ship the playground page — it unblocks every other chat tweak.',
    },
  },
  {
    name: 'image',
    component: {
      type: 'image',
      url: 'https://beedocs.pages.dev/assets/bee.webp',
      alt: 'Bee, the BeeGreat mascot',
      title: 'bee.webp',
    },
  },
  {
    name: 'bookmark',
    component: {
      type: 'bookmark',
      title: 'Expo documentation',
      url: 'https://docs.expo.dev',
      note: 'SDK 57 reference saved for the chat-interface work.',
    },
  },
  {
    name: 'devin',
    component: {
      type: 'devin',
      title: 'Migrate settings rows to form sheets',
      status: 'working',
      statusDetail: 'running_tests',
      sessionId: 'devin-playground',
      sessionUrl: 'https://app.devin.ai',
      summary: 'Profile, connections, and jobs screens all present as sheets.',
      pullRequests: [{ url: 'https://github.com', state: 'open' }],
    },
  },
  {
    name: 'first_focus',
    component: {
      type: 'first_focus',
      requestId: 'playground-request',
      goalTitle: 'Ship BeeGreat 1.0',
      projectTitle: 'Chat interface',
      taskTitle: 'Component playground page',
    },
  },
  {
    name: 'confirm',
    component: {
      type: 'confirm',
      summary: 'Delete three archived goals and their open tasks?',
      action: 'delete_archived_goals',
    },
  },
  {
    name: 'question',
    component: {
      type: 'question',
      questions: [
        {
          header: 'Scope',
          question: 'Which surfaces should the playground cover?',
          options: [
            { label: 'Chat only', description: 'Just the agent surface' },
            {
              label: 'Every domain',
              description: 'Goals, Mind, Hive, Bee Healthy too',
            },
          ],
        },
        {
          header: 'Theme',
          question: 'Which appearance should it default to?',
        },
      ],
    },
  },
];

export const ATTACHMENTS: AttachmentData[] = [
  {
    id: 'fixture-att-1',
    mediaType: 'image/png',
    url: 'https://beedocs.pages.dev/assets/bee.png',
    filename: 'bee.png',
  },
  {
    id: 'fixture-att-2',
    mediaType: 'application/pdf',
    filename: 'launch-plan.pdf',
  },
  { id: 'fixture-att-3', mediaType: 'audio/m4a', filename: 'voice-note.m4a' },
];

function conversationMessage(
  message: Pick<FlueConversationMessage, 'id' | 'role' | 'parts'>,
): FlueConversationMessage {
  return {
    purpose: message.role === 'user' ? 'user' : 'assistant',
    display: 'visible',
    ...message,
  };
}

const BEEUI_BLOCK = [
  '```beeui',
  JSON.stringify({
    components: [
      {
        type: 'highlight',
        title: 'The one thing',
        body: 'Ship the playground page first.',
      },
      {
        type: 'tasks',
        title: 'Today',
        items: [
          { id: 'fixture-conv-1', title: 'Wire the route', done: true },
          { id: 'fixture-conv-2', title: 'Fill the fixtures', done: false },
        ],
      },
    ],
  }),
  '```',
].join('\n');

export const CONVERSATION_MESSAGES: FlueConversationMessage[] = [
  conversationMessage({
    id: 'pg-1',
    role: 'user',
    parts: [
      { type: 'text', text: 'What should I focus on today?', state: 'done' },
    ],
  }),
  conversationMessage({
    id: 'pg-2',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'Check the open goals, see which tasks are due, then pick one clear focus.',
        state: 'done',
      },
      {
        type: 'dynamic-tool',
        toolName: 'get_goals',
        toolCallId: 'pg-call-1',
        state: 'output-available',
        input: {},
        output: { goals: [{ title: 'Ship BeeGreat 1.0', openTasks: 4 }] },
      },
      {
        type: 'dynamic-tool',
        toolName: 'search_mind',
        toolCallId: 'pg-call-2',
        state: 'output-error',
        input: { query: 'playground' },
        errorText: 'The Mind index is still warming up.',
        durationMs: 812,
      },
      {
        type: 'text',
        text: `Your sharpest edge is the chat gallery — it unblocks every other tweak.\n\n${BEEUI_BLOCK}`,
        state: 'done',
      },
    ],
  }),
  conversationMessage({
    id: 'pg-3',
    role: 'user',
    parts: [{ type: 'text', text: 'Do it.', state: 'done' }],
  }),
  conversationMessage({
    id: 'pg-4',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolName: 'task',
        toolCallId: 'pg-call-3',
        state: 'input-available',
        input: { agent: 'devin', prompt: 'Review the playground diff' },
      },
      { type: 'reasoning', text: 'Drafting the reply…', state: 'streaming' },
    ],
  }),
];

export const CURRENCIES = {
  honeyBalance: 68,
  honeycombScore: 1284,
  royalJellyBalance: 3,
};

export const ACHIEVEMENTS: AchievementSummary[] = [
  { id: 'hive:first-goal', title: 'First goal', kind: 'hive' },
  { id: 'hive:first-goliebee', title: 'Golie', kind: 'goliebee' },
];

const today = new Date();
const DAY_MS = 86_400_000;
const WEEK_MOODS: WeekPulseEntry['mood'][] = [
  'good',
  'okay',
  'great',
  'bad',
  'good',
  'okay',
  'great',
];

export const WEEK_PULSE: WeekPulseEntry[] = Array.from(
  { length: 7 },
  (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * DAY_MS);
    return {
      localDate: localDateKey(date),
      mood: WEEK_MOODS[index] ?? null,
      hydrationMl: 600 + index * 280,
      journal: index % 2 === 0 ? 'entry' : '',
    };
  },
);

export const JOURNAL_MONTH_DAYS: JournalMonthDay[] = [
  {
    localDate: localDateKey(new Date(today.getTime() - 4 * DAY_MS)),
    entryCount: 1,
    hasPhoto: false,
  },
  {
    localDate: localDateKey(new Date(today.getTime() - 2 * DAY_MS)),
    entryCount: 2,
    hasPhoto: true,
  },
  { localDate: localDateKey(today), entryCount: 1, hasPhoto: false },
];

export const JOURNAL_ENTRY: JournalTimelineEntry = {
  id: 'playground-entry' as Id<'journalEntries'>,
  localDate: localDateKey(today),
  timeZone: 'Europe/Rome',
  occurredAt: today.getTime() - 3_600_000,
  title: 'Morning pages',
  body: 'Morning pages\n\nWrote three pages before the first meeting. The playground idea fell out of page two — every component, one page, fixtures at the top of the file.',
  tags: ['writing', 'beegreat'],
  isPinned: true,
  isFavorite: false,
  coverPhoto: {
    kind: 'photo',
    id: 'playground-photo' as Id<'journalAttachments'>,
    url: 'https://beedocs.pages.dev/assets/bee.png',
    mimeType: 'image/png',
    createdAt: today.getTime() - 3_600_000,
  },
  attachmentCount: 1,
  createdAt: today.getTime() - 3_600_000,
  updatedAt: today.getTime() - 3_600_000,
};

function bookmark(
  item: Pick<BookmarkItem, '_id' | 'url' | 'kind' | 'status'> &
    Partial<BookmarkItem>,
): BookmarkItem {
  return {
    _creationTime: today.getTime() - DAY_MS,
    title: undefined,
    summary: undefined,
    labels: [],
    note: undefined,
    meta: undefined,
    transcriptSource: undefined,
    errorCode: undefined,
    errorMessage: undefined,
    retryCount: 0,
    createdAt: today.getTime() - DAY_MS,
    updatedAt: today.getTime() - DAY_MS,
    ...item,
  };
}

export const BOOKMARKS: BookmarkItem[] = [
  bookmark({
    _id: 'playground-bookmark-1' as Id<'bookmarks'>,
    url: 'https://docs.expo.dev',
    kind: 'website',
    status: 'ready',
    title: 'Expo documentation',
    summary: 'SDK 57 reference.',
    labels: ['docs'],
  }),
  bookmark({
    _id: 'playground-bookmark-2' as Id<'bookmarks'>,
    url: 'https://x.com/expo',
    kind: 'tweet',
    status: 'ready',
    title: 'Expo on X',
    meta: { handle: '@expo' },
  }),
  bookmark({
    _id: 'playground-bookmark-3' as Id<'bookmarks'>,
    url: 'https://www.youtube.com/watch?v=example',
    kind: 'youtube',
    status: 'failed',
    title: 'Talk: App.js keynote',
    labels: ['video'],
    retryCount: 2,
  }),
];
