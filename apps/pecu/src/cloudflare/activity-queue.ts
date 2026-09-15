const prefix = "pecu-activity:";
export type ActivityQueueStore = Pick<DurableObjectStorage, "put" | "list" | "delete" | "getAlarm" | "setAlarm">;

export class ActivityQueue {
  constructor(private readonly storage: ActivityQueueStore) {}

  async enqueue(body: unknown): Promise<void> {
    const key = `${prefix}${String(Date.now()).padStart(16, "0")}:${crypto.randomUUID()}`;
    await this.storage.put(key, body);
    await this.wake();
  }

  async wake(): Promise<void> {
    const soon = Date.now() + 1000;
    const scheduled = await this.storage.getAlarm();
    if (scheduled === null || scheduled > soon) await this.storage.setAlarm(soon);
  }

  async pending(): Promise<boolean> {
    return (await this.storage.list({ prefix, limit: 1 })).size > 0;
  }

  async drain(handle: (body: unknown) => Promise<unknown>): Promise<void> {
    for (const [key, body] of await this.storage.list({ prefix, limit: 4 })) {
      await handle(body);
      await this.storage.delete(key);
    }
  }
}
