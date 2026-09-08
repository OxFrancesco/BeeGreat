// Expo's audio mode is process-wide. A cancelled live startup must finish
// releasing it before a voice note or speech playback changes that mode.
let pending: Promise<void> = Promise.resolve();

export function enqueueAudioOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.then(() => undefined, () => undefined);
  return result;
}
