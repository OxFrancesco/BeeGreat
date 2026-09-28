import { z } from "zod";
import { threadPageSchema, webStateSchema, type ThreadPage, type WebState } from "../../../../src/web-contract";
import { historyBytes, THREAD_CACHE_BYTES, THREAD_CACHE_LIMIT } from "./thread-cache";

const maxAge = 24 * 60 * 60 * 1000;
const schema = z.object({ at: z.number(), threads: threadPageSchema, states: z.array(webStateSchema).max(THREAD_CACHE_LIMIT) });
export type HistorySnapshot = { at: number; threads: ThreadPage; states: WebState[] };
export function historySnapshot(threads: ThreadPage, states: WebState[]): HistorySnapshot {
  let bytes = 0;
  const bounded = states.slice(-THREAD_CACHE_LIMIT).reverse().filter((state) => {
    const size = historyBytes(state);
    if (bytes + size > THREAD_CACHE_BYTES) return false;
    bytes += size; return true;
  }).reverse();
  return { at: Date.now(), threads, states: bounded };
}
export function readHistorySnapshot(value: unknown): HistorySnapshot | null {
  const result = schema.safeParse(value);
  if (!result.success || Date.now() - result.data.at > maxAge || result.data.at > Date.now() + 60_000) return null;
  return { ...historySnapshot(result.data.threads, result.data.states), at: result.data.at };
}

function database(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open("pecu-history-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("accounts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => resolve(null);
  });
}
const epochs = new Map<string, number>();
export const historyStorage = {
  async read(owner: string): Promise<HistorySnapshot | null> {
    try {
      const db = await database(); if (!db) return null;
      return await new Promise((resolve) => {
        const tx = db.transaction("accounts", "readonly");
        const request = tx.objectStore("accounts").get(owner);
        request.onsuccess = () => resolve(readHistorySnapshot(request.result));
        request.onerror = () => resolve(null);
        tx.oncomplete = tx.onabort = () => db.close();
      });
    } catch { return null; }
  },
  async write(owner: string, snapshot: HistorySnapshot) {
    const epoch = epochs.get(owner) ?? 0;
    try {
      const db = await database(); if (!db) return;
      if ((epochs.get(owner) ?? 0) !== epoch) { db.close(); return; }
      const tx = db.transaction("accounts", "readwrite");
      tx.objectStore("accounts").put(snapshot, owner);
      await new Promise<void>((resolve) => { tx.oncomplete = tx.onabort = () => { db.close(); resolve(); }; });
    } catch { /* Private browsing and quota limits must not block network history. */ }
  },
  async remove(owner: string) {
    epochs.set(owner, (epochs.get(owner) ?? 0) + 1);
    try {
      const db = await database(); if (!db) return;
      const tx = db.transaction("accounts", "readwrite"); tx.objectStore("accounts").delete(owner);
      await new Promise<void>((resolve) => { tx.oncomplete = tx.onabort = () => { db.close(); resolve(); }; });
    } catch { /* The in-memory account is still cleared. */ }
  },
};
