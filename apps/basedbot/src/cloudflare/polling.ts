export function shouldRunScheduledPoll(lastPollAt: number | undefined, now: number, intervalMs: number, notBefore = 0): boolean {
  if (now < notBefore) return false;
  return lastPollAt === undefined || now - lastPollAt >= Math.max(1_000, intervalMs - 5_000);
}
