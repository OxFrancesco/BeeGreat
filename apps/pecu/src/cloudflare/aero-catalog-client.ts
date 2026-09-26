import { z } from "zod";
import type { CatalogSource } from "./aero-cache";
import type { CatalogKind } from "./catalog-refresh";
const snapshotSchema = z.object({ expiresAt: z.number(), value: z.unknown() });

export function catalogSource(namespace: DurableObjectNamespace): CatalogSource {
  return async kind => {
    const response = await namespace.get(namespace.idFromName("base-catalog-v1")).fetch(`https://catalog.internal/${kind}`);
    if (!response.ok) throw new Error("Public catalog is temporarily unavailable");
    return snapshotSchema.parse(await response.json());
  };
}

export async function refreshCatalogs(env: AeroEnv, scheduledTime: number): Promise<void> {
  const kinds: CatalogKind[] = ["pools", "swap-topology"];
  if (Math.floor(scheduledTime / 60_000) % 5 === 0) kinds.push("tokens");
  const stub = env.AERO_REFRESH.get(env.AERO_REFRESH.idFromName("base-catalog-v1"));
  for (const kind of kinds) {
    const response = await stub.fetch(`https://catalog.internal/${kind}`, { method: "POST" });
    if (!response.ok) throw new Error(`Failed to refresh ${kind}`);
    await response.body?.cancel();
  }
}
