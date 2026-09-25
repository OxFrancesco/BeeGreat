import { jsonValueSchema, type JsonValue } from "../json-contract";
const prefix = "basedbot-activity:";
export type ActivityQueueStore = {
  put(key: string, body: JsonValue): Promise<void>;
  list(options: { prefix: string; limit: number }): Promise<Map<string, JsonValue>>;
  delete(key: string): Promise<boolean>;
  getAlarm(): Promise<number | null>;
  setAlarm(time: number): Promise<void>;
};

export class ActivityQueue {
  constructor(private readonly storage: ActivityQueueStore) {}

  async enqueue(body: JsonValue): Promise<void> {
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

  async drain<Result>(handle: (body: JsonValue) => Promise<Result>): Promise<void> {
    for (const [key, body] of await this.storage.list({ prefix, limit: 4 })) {
      await handle(jsonValueSchema.parse(body));
      await this.storage.delete(key);
    }
  }
}
