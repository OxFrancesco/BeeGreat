import { useSyncExternalStore } from "react";

export function openChatGptConnection() {
  window.location.hash = "chatgpt";
}

export function closeChatGptConnection() {
  if (window.location.hash !== "#chatgpt") return;
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** Last ChatGPT connection state observed by any profile view in this page; null until one has loaded. */
let connected: boolean | null = null;
const listeners = new Set<() => void>();

export function setChatGptConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  for (const listener of listeners) listener();
}

export function useChatGptConnected() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => connected,
    () => null,
  );
}
