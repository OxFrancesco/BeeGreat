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

export type MindView = 'hex' | 'cards' | 'list';

const MIND_VIEW_KEY = 'bee.mindView';
const storedMindView = SecureStore.getItem(MIND_VIEW_KEY);
let mindView: MindView =
  storedMindView === 'cards' || storedMindView === 'list' ? storedMindView : 'hex';
const mindViewListeners = new Set<() => void>();

export function setMindView(view: MindView) {
  mindView = view;
  mindViewListeners.forEach((listener) => listener());
  try {
    SecureStore.setItem(MIND_VIEW_KEY, view);
  } catch {
    // Persistence is best-effort; the selected view still changes immediately.
  }
}

function subscribeMindView(listener: () => void) {
  mindViewListeners.add(listener);
  return () => {
    mindViewListeners.delete(listener);
  };
}

export function useMindView() {
  return useSyncExternalStore(subscribeMindView, () => mindView);
}
