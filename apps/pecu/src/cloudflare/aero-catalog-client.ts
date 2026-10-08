import { z } from "zod";
import type { CatalogSource } from "./aero-cache";
import { catalogKinds, type CatalogKind } from "./catalog-refresh";
const snapshotSchema = z.object({ expiresAt: z.number(), value: z.unknown() });
const tickSchema = z.object({ status: z.enum(["refreshed", "fresh", "idle", "deferred"]) });

export type CatalogTick = { kind: CatalogKind; status: z.output<typeof tickSchema>["status"] | "failed" };

export function catalogSource(namespace: DurableObjectNamespace): CatalogSource {
  return async kind => {
    const response = await namespace.get(namespace.idFromName("base-catalog-v1")).fetch(`https://catalog.internal/${kind}`);
    if (!response.ok) throw new Error("Public catalog is temporarily unavailable");
    return snapshotSchema.parse(await response.json());
  };
}

/** One keep-warm tick per kind, in sequence to stay under the provider's RPS limit. A failed kind never blocks the others. */
export async function refreshCatalogs(env: AeroEnv): Promise<CatalogTick[]> {
  const stub = env.AERO_REFRESH.get(env.AERO_REFRESH.idFromName("base-catalog-v1"));
  const ticks: CatalogTick[] = [];
  for (const kind of catalogKinds) {
    try {
      const response = await stub.fetch(`https://catalog.internal/${kind}`, { method: "POST" });
      const tick = tickSchema.safeParse(await response.json().catch(() => undefined));
      ticks.push({ kind, status: response.ok && tick.success ? tick.data.status : "failed" });
    } catch {
      ticks.push({ kind, status: "failed" });
    }
  }
  return ticks;
}
