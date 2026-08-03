import { useSyncExternalStore } from 'react';

import { getPreference, setPreference } from '@/lib/preferences-storage';

/** Tiny persisted preference store (module state + SecureStore). */

const SPEAK_REPLIES_KEY = 'bee.speakReplies';

let speakReplies = getPreference(SPEAK_REPLIES_KEY) !== 'off';
const listeners = new Set<() => void>();

export function getSpeakReplies() {
  return speakReplies;
}

export function setSpeakReplies(enabled: boolean) {
  speakReplies = enabled;
  listeners.forEach((listener) => listener());
  try {
    setPreference(SPEAK_REPLIES_KEY, enabled ? 'on' : 'off');
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

export type VoiceMode = 'voice-note' | 'conversation';

const VOICE_MODE_KEY = 'bee.voiceMode';
let voiceMode: VoiceMode =
  getPreference(VOICE_MODE_KEY) === 'conversation'
    ? 'conversation'
    : 'voice-note';
const voiceModeListeners = new Set<() => void>();

export function getVoiceMode() {
  return voiceMode;
}

export function setVoiceMode(mode: VoiceMode) {
  voiceMode = mode;
  voiceModeListeners.forEach((listener) => listener());
  try {
    setPreference(VOICE_MODE_KEY, mode);
  } catch {
    // Persistence is best-effort; the selected mode still applies this session.
  }
}

function subscribeVoiceMode(listener: () => void) {
  voiceModeListeners.add(listener);
  return () => {
    voiceModeListeners.delete(listener);
  };
}

/** Voice note keeps Bee's STT pipeline; conversation opens xAI realtime voice. */
export function useVoiceMode() {
  return useSyncExternalStore(subscribeVoiceMode, getVoiceMode);
}

const PAYWALL_SEEN_KEY = 'bee.paywallSeen';

let paywallSeen = getPreference(PAYWALL_SEEN_KEY) === 'yes';
const paywallSeenListeners = new Set<() => void>();

export function markPaywallSeen() {
  paywallSeen = true;
  paywallSeenListeners.forEach((listener) => listener());
  try {
    setPreference(PAYWALL_SEEN_KEY, 'yes');
  } catch {
    // Persistence is best-effort; the paywall stays dismissed this session.
  }
}

function subscribePaywallSeen(listener: () => void) {
  paywallSeenListeners.add(listener);
  return () => {
    paywallSeenListeners.delete(listener);
  };
}

/** Whether the launch paywall was already shown once (it only appears once). */
export function usePaywallSeen() {
  return useSyncExternalStore(subscribePaywallSeen, () => paywallSeen);
}

export type MindView = 'hex' | 'cards' | 'list';

const MIND_VIEW_KEY = 'bee.mindView';
const storedMindView = getPreference(MIND_VIEW_KEY);
let mindView: MindView =
  storedMindView === 'cards' || storedMindView === 'list' ? storedMindView : 'hex';
const mindViewListeners = new Set<() => void>();

export function setMindView(view: MindView) {
  mindView = view;
  mindViewListeners.forEach((listener) => listener());
  try {
    setPreference(MIND_VIEW_KEY, view);
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
