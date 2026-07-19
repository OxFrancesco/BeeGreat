export async function resolveAppleAuthenticationAvailability(
  platform: string,
  isAvailableAsync: () => Promise<boolean>,
): Promise<boolean> {
  if (platform !== 'ios') return false;

  try {
    return await isAvailableAsync();
  } catch {
    return false;
  }
}
