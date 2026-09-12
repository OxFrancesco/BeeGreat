export const HONEY_CAPACITY = 100;

export function honeyState(balance: number) {
  const safe = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  const amount = Math.min(safe, HONEY_CAPACITY);
  const overflow = Math.max(0, safe - HONEY_CAPACITY);
  return {
    amount,
    ratio: amount / HONEY_CAPACITY,
    label: overflow > 0
      ? `${safe} Honey, vessel full with ${overflow} Honey in overflow`
      : `${safe} of ${HONEY_CAPACITY} Honey, ${Math.round(amount)}% full`,
  };
}
