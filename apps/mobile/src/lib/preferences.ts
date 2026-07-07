import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/** Tiny persisted preference store (module state + SecureStore). */

const SPEAK_REPLIES_KEY = 'bee.speakReplies';

let speakReplies = SecureStore.getItem(SPEAK_REPLIES_KEY) !== 'off';
const listeners = new Set<() => void>();

export function getSpeakReplies() {
  return speakReplies;
}

export function setSpeakReplies(enabled: boolean) {
  speakReplies = enabled;
  listeners.forEach((listener) => listener());
  try {
    SecureStore.setItem(SPEAK_REPLIES_KEY, enabled ? 'on' : 'off');
  } catch {
    // Persistence is best-effort; the in-memory value still applies.
  }
}

export function subscribeSpeakReplies(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether Bee reads its replies aloud (defaults to on). */
export function useSpeakReplies() {
  return useSyncExternalStore(subscribeSpeakReplies, getSpeakReplies);
}

/**
 * Chat threads. Each thread keys one agent conversation (`userId` for thread
 * 0, `userId~<id>` otherwise). The list lives locally; the transcripts
 * themselves live with the agent.
 */
export type ChatThread = {
  id: number;
  createdAt: number;
  /** First user message, captured as the thread label. */
  title?: string;
};

const THREADS_KEY = 'bee.threads';
const ACTIVE_THREAD_KEY = 'bee.activeThread';
const LEGACY_SESSION_KEY = 'bee.conversationSession';

function loadThreads(): ChatThread[] {
  try {
    const raw = SecureStore.getItem(THREADS_KEY);
    if (raw) return JSON.parse(raw) as ChatThread[];
  } catch {
    // Fall through to migration below.
  }
  // First run (or pre-threads build): seed with the current session so the
  // active conversation keeps its id.
  const legacy = Number(SecureStore.getItem(LEGACY_SESSION_KEY) ?? '0') || 0;
  return [{ id: legacy, createdAt: Date.now() }];
}

let threads = loadThreads();
let activeThread = (() => {
  const raw = Number(SecureStore.getItem(ACTIVE_THREAD_KEY) ?? 'NaN');
  return threads.some((thread) => thread.id === raw) ? raw : threads[threads.length - 1].id;
})();

const threadListeners = new Set<() => void>();

function persistThreads() {
  try {
    SecureStore.setItem(THREADS_KEY, JSON.stringify(threads));
    SecureStore.setItem(ACTIVE_THREAD_KEY, String(activeThread));
  } catch {
    // Persistence is best-effort; the in-memory value still applies.
  }
}

function notifyThreads() {
  threadListeners.forEach((listener) => listener());
  persistThreads();
}

export function getThreads() {
  return threads;
}

export function getActiveThread() {
  return activeThread;
}

export function setActiveThread(id: number) {
  if (id === activeThread || !threads.some((thread) => thread.id === id)) return;
  activeThread = id;
  notifyThreads();
}

/** Creates a fresh thread, makes it active, and returns its id. */
export function startNewThread() {
  // Timestamp ids stay unique across devices sharing the same account; a
  // per-device counter (max + 1) collides with threads created elsewhere,
  // silently reattaching to that other device's conversation.
  const id = Math.max(Date.now(), ...threads.map((thread) => thread.id + 1));
  threads = [...threads, { id, createdAt: Date.now() }];
  activeThread = id;
  notifyThreads();
  return id;
}

/** Labels a thread with its first user message; later calls are no-ops. */
export function setThreadTitle(id: number, title: string) {
  const thread = threads.find((entry) => entry.id === id);
  const trimmed = title.trim();
  if (!thread || thread.title || !trimmed) return;
  threads = threads.map((entry) => (entry.id === id ? { ...entry, title: trimmed } : entry));
  notifyThreads();
}

export function subscribeThreads(listener: () => void) {
  threadListeners.add(listener);
  return () => {
    threadListeners.delete(listener);
  };
}

export function useThreads() {
  return useSyncExternalStore(subscribeThreads, getThreads);
}

/** Id of the conversation the chat screen is showing. */
export function useActiveThread() {
  return useSyncExternalStore(subscribeThreads, getActiveThread);
}
