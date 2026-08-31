import type { api } from '@beegreat/backend/convex/_generated/api';
import type { FlueConversationMessage } from '@flue/react';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import {
  createContext,
  type PropsWithChildren,
  use,
} from 'react';

import type { BookmarkItem } from '@/components/mind/bookmark-item';
import type { ChatThread } from '@/hooks/use-convex-chat';
import type { MindView } from '@/lib/preferences';

export const SCREENSHOT_SHOTS = [
  'bee-focus',
  'goals-plan',
  'hive-progress',
  'voice-with-bee',
  'mind-bookmarks',
] as const;

export type ScreenshotShot = (typeof SCREENSHOT_SHOTS)[number];

export type ScreenshotAgentState = {
  messages: FlueConversationMessage[];
  busy: boolean;
  recording: boolean;
  errorMessage?: string;
  sendText: (text: string) => void | Promise<void>;
};

export type ScreenshotFixtureValue = {
  shot: ScreenshotShot;
  selectShot: (shot: ScreenshotShot) => void;
  agent: ScreenshotAgentState;
  goals: FunctionReturnType<typeof api.goals.list>;
  project: FunctionReturnType<typeof api.projects.get>;
  tasks: FunctionReturnType<typeof api.tasks.listByProject>;
  hive: FunctionReturnType<typeof api.firstFocus.getCurrent>;
  hiveCompletion: {
    result: FunctionReturnType<typeof api.firstFocus.completeHighlight>;
    goal: FunctionReturnType<typeof api.firstFocus.getCurrent>['activeGoals'][number] | null;
    highlightTitle: string;
  };
  bookmarks: BookmarkItem[];
  bookmarkLabels: { label: string; count: number }[];
  mindView: MindView;
  threads: ChatThread[];
  activeThread: number;
  confirmFirstFocus: (
    args: FunctionArgs<typeof api.firstFocus.confirmPlan>,
  ) => Promise<FunctionReturnType<typeof api.firstFocus.confirmPlan>>;
};

const ScreenshotFixtureContext = createContext<ScreenshotFixtureValue | null>(
  null,
);

export function ScreenshotFixtureProvider({
  children,
  value,
}: PropsWithChildren<{ value: ScreenshotFixtureValue }>) {
  return (
    <ScreenshotFixtureContext.Provider value={value}>
      {children}
    </ScreenshotFixtureContext.Provider>
  );
}

/** Null in every normal build/runtime path; populated only by the dev harness. */
export function useScreenshotFixture() {
  return use(ScreenshotFixtureContext);
}

export function isScreenshotShot(value: string): value is ScreenshotShot {
  return SCREENSHOT_SHOTS.some((shot) => shot === value);
}
