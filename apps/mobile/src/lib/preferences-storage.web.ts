export function getPreference(key: string) {
  if (!('window' in globalThis)) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setPreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Persistence is best-effort, matching SecureStore on native.
  }
}
