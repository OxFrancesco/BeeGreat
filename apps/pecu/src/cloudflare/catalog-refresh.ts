export type CatalogKind = "tokens" | "pools" | "swap-topology";
export type CatalogSnapshot<T> = { value: T; expiresAt: number };

/** Lives inside the catalog Durable Object, never in a request Worker isolate. */
export class CatalogRefresh<T> {
  private readonly snapshots = new Map<CatalogKind, CatalogSnapshot<T>>();
  private readonly pending = new Map<CatalogKind, Promise<CatalogSnapshot<T>>>();

  constructor(private readonly load: (kind: CatalogKind, refresh: boolean) => Promise<CatalogSnapshot<T>>, private readonly now = Date.now) {}

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
