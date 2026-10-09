export type CatalogKind = "tokens" | "pools" | "swap-topology";
export type CatalogSnapshot<T> = { value: T; expiresAt: number };

export const catalogKinds: readonly CatalogKind[] = ["pools", "swap-topology", "tokens"];
export const catalogTtlMs = { tokens: 600_000, pools: 180_000, "swap-topology": 180_000 } as const satisfies Record<CatalogKind, number>;
/** A keep-warm tick replaces a snapshot once less than this remains, so a one-minute cron never lets it lapse. */
export const catalogRefreshAheadMs = 90_000;
/** Background refreshes continue this long after the last demand read; idle catalogs cost no RPC. */
export const catalogKeepWarmMs = 30 * 60_000;
const firstBackoffMs = 60_000;
const maximumBackoffMs = 30 * 60_000;

export type CatalogFailure = Readonly<{
  failures: number;
  failedAt: number;
  notBefore: number;
  stage: string;
  code?: string;
}>;

export function nextCatalogFailure(previous: CatalogFailure | undefined, now: number, detail: { stage: string; code?: string }): CatalogFailure {
  const failures = (previous?.failures ?? 0) + 1;
  return { ...detail, failures, failedAt: now, notBefore: now + Math.min(firstBackoffMs * 2 ** (failures - 1), maximumBackoffMs) };
}

export type KeepWarmDecision = "idle" | "fresh" | "deferred" | "refresh";

export function keepWarmDecision(input: {
  now: number;
  lastDemandAt: number | undefined;
  snapshot: CatalogSnapshot<unknown> | undefined;
  failure: CatalogFailure | undefined;
}): KeepWarmDecision {
  if (input.lastDemandAt === undefined || input.now - input.lastDemandAt > catalogKeepWarmMs) return "idle";
  if (input.snapshot && input.snapshot.expiresAt - input.now > catalogRefreshAheadMs) return "fresh";
  if (input.failure && input.now < input.failure.notBefore) return "deferred";
  return "refresh";
}

/** Lives inside the catalog Durable Object, never in a request Worker isolate. */
export class CatalogRefresh<T> {
  private readonly snapshots = new Map<CatalogKind, CatalogSnapshot<T>>();
  private readonly pending = new Map<CatalogKind, Promise<CatalogSnapshot<T>>>();

  constructor(private readonly load: (kind: CatalogKind, refresh: boolean) => Promise<CatalogSnapshot<T>>, private readonly now = Date.now) {}

  peek(kind: CatalogKind): CatalogSnapshot<T> | undefined {
    return this.snapshots.get(kind);
  }

  get(kind: CatalogKind, refresh = false): Promise<CatalogSnapshot<T>> {
    const cached = this.snapshots.get(kind);
    if (!refresh && cached && cached.expiresAt > this.now()) return Promise.resolve(cached);
    const pending = this.pending.get(kind);
    if (pending) return pending;
    const task = this.load(kind, refresh).then(snapshot => {
      this.snapshots.set(kind, snapshot);
      return snapshot;
    }).finally(() => this.pending.delete(kind));
    this.pending.set(kind, task);
    return task;
  }
}
