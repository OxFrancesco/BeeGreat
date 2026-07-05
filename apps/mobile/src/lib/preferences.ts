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

const CONVERSATION_SESSION_KEY = 'bee.conversationSession';

let conversationSession = Number(SecureStore.getItem(CONVERSATION_SESSION_KEY) ?? '0') || 0;
const sessionListeners = new Set<() => void>();

export function getConversationSession() {
  return conversationSession;
}

/** Bumps the session counter, which keys a brand-new agent conversation. */
export function startNewConversationSession() {
  conversationSession += 1;
  sessionListeners.forEach((listener) => listener());
  try {
    SecureStore.setItem(CONVERSATION_SESSION_KEY, String(conversationSession));
  } catch {
    // Persistence is best-effort; the in-memory value still applies.
  }
}

export function subscribeConversationSession(listener: () => void) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/** Monotonic counter identifying the current conversation session. */
export function useConversationSession() {
  return useSyncExternalStore(subscribeConversationSession, getConversationSession);
}
