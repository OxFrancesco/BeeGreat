import { tupleValues } from "@beegreat/sugar";

/** Sugar's ordered catalog can shift when pools are added. Verify a bounded neighborhood. */
export async function nearbyPoolOffset(address: string, offset: number, read: (limit: number, offset: number) => Promise<readonly unknown[]>): Promise<number | undefined> {
  const start = Math.max(0, offset - 16);
  const rows = await read(33, start);
  const index = rows.findIndex(row => String(tupleValues(row)[0]).toLowerCase() === address.toLowerCase());
  return index < 0 ? undefined : start + index;
}
