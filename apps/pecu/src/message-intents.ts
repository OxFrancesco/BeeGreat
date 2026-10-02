import type { PecuStore, Intent } from "./state";
import { maxRunSteps } from "./task-contract";

export function messageIntents(store: Pick<PecuStore, "intentForSource">, eventId: string): Intent[] {
  const intents: Intent[] = [];
  for (let step = 1; step <= maxRunSteps; step++) {
    const intent = store.intentForSource(step === 1 ? eventId : `${eventId}#${step}`);
    if (!intent) break;
    intents.push(intent);
  }
  return intents;
}
