/**
 * Tiny event bus that lets the tab bar's mic trigger reach the voice agent
 * living inside the Bee screen without lifting the whole hook up the tree.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onMicPress(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitMicPress() {
  for (const listener of listeners) listener();
}
