export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const incoming = new URL(path, 'beegreat://app');
    if (incoming.hostname === 'expo-sharing') return '/share';
    return path;
  } catch {
    return '/';
  }
}
