import { DurableObject } from "cloudflare:workers";
import { createSugarClient, createSugarCacheStore, toSugarJson, type SugarJson } from "@beegreat/sugar";
import { z } from "zod";
import { indexPools, poolIndexSchema } from "../pool-discovery";
import { tokenSchema } from "./aero-cache";
import { CatalogRefresh, catalogTtlMs, keepWarmDecision, nextCatalogFailure, type CatalogFailure, type CatalogKind, type CatalogSnapshot } from "./catalog-refresh";
import { CatalogStageError, catalogErrorFields, sanitizeErrorText, type CatalogStage } from "./catalog-error";
import { log } from "../logger";
import { cacheDeadline } from "./cache-deadline";

const kindSchema = z.enum(["tokens", "pools", "swap-topology"]);
const snapshotSchema = z.object({ expiresAt: z.number(), value: z.unknown() });
const demandKey = "demand-at";
const failureKey = (kind: CatalogKind) => `refresh-failure:${kind}`;
/** Full catalogs are several megabytes; the request-path cache deadline is too short for their R2 writes. */
const snapshotWriteDeadlineMs = 20_000;

const errorText = (cause: unknown) => sanitizeErrorText(cause instanceof Error ? cause.message : String(cause));

/** When a reader last missed the shared caches; persisted at most once a minute. */
type Demand = { loaded: boolean; at?: number; storedAt?: number };

export class AeroCatalog extends DurableObject<AeroEnv> {
  private readonly refresh = new CatalogRefresh<SugarJson>((kind, force) => this.tracked(kind, force));
  private demand: Demand = { loaded: false };

  private async load(kind: CatalogKind, force: boolean): Promise<CatalogSnapshot<SugarJson>> {
    const startedAt = Date.now();
    const client = createSugarClient(8453, { rpcUrl: this.env.ALCHEMY_RPC_URL, cacheStore: createSugarCacheStore(), settings: { requestConcurrency: 4 } });
    const key = `v1/${kind}:8453:${client.settings.sugarContractAddress.toLowerCase()}`;
    const schema = kind === "tokens" ? z.array(tokenSchema) : kind === "pools" ? poolIndexSchema : z.array(z.unknown());
    if (!force) {
      try {
        const parsed = await cacheDeadline((async () => {
          const object = await this.env.AERO_CATALOG.get(key);
          return object ? snapshotSchema.safeParse(JSON.parse(await object.text())) : undefined;
        })());
        if (parsed?.success && parsed.data.expiresAt > Date.now()) {
          const data = schema.safeParse(parsed.data.value);
          if (data.success) return { expiresAt: parsed.data.expiresAt, value: toSugarJson(data.data) };
        }
      } catch (error) { log("warn", "aero_catalog_read_failed", { kind, error_message: errorText(error) }); }
    }
    let stage: CatalogStage = "rpc";
    let value: SugarJson;
    let entries: number;
    try {
      const raw = kind === "tokens" ? await client.getAllTokens(false) : await client.getRawPools(kind === "swap-topology");
      stage = "index";
      const data = kind === "pools" ? indexPools(raw) : raw;
      stage = "validate";
      value = toSugarJson(schema.parse(data));
      entries = data.length;
    } catch (error) {
      throw new CatalogStageError(stage, { cause: error });
    }
    const snapshot = { expiresAt: Date.now() + catalogTtlMs[kind], value };
    try { await cacheDeadline(this.env.AERO_CATALOG.put(key, JSON.stringify(snapshot)), snapshotWriteDeadlineMs); }
    catch (error) { log("warn", "aero_catalog_write_failed", { kind, error_message: errorText(error) }); }
    log("info", "aero_catalog_refreshed", { kind, duration_ms: Date.now() - startedAt, entries, expires_at: snapshot.expiresAt });
    return snapshot;
  }

  /** Runs once per single-flight load, so concurrent readers record one failure. */
  private async tracked(kind: CatalogKind, force: boolean): Promise<CatalogSnapshot<SugarJson>> {
    try {
      const snapshot = await this.load(kind, force);
      await this.ctx.storage.delete(failureKey(kind));
      return snapshot;
    } catch (error) {
      const fields = catalogErrorFields(error);
      const failure = nextCatalogFailure(await this.ctx.storage.get<CatalogFailure>(failureKey(kind)), Date.now(), { stage: fields.stage, code: fields.error_code });
      await this.ctx.storage.put(failureKey(kind), failure);
      log("error", "aero_catalog_refresh_failed", { kind, ...fields, failures: failure.failures, retry_after: new Date(failure.notBefore).toISOString() });
      throw error;
    }
  }

  private async lastDemandAt(): Promise<number | undefined> {
    if (!this.demand.loaded) {
      const storedAt = await this.ctx.storage.get<number>(demandKey);
      this.demand = { loaded: true, at: storedAt, storedAt };
    }
    return this.demand.at;
  }

  private async recordDemand(now: number): Promise<void> {
    await this.lastDemandAt();
    this.demand.at = now;
    if (this.demand.storedAt !== undefined && now - this.demand.storedAt < 60_000) return;
    this.demand.storedAt = now;
    await this.ctx.storage.put(demandKey, now);
  }

  /** GET serves a reader and counts as demand. POST is the cron keep-warm tick. */
  override async fetch(request: Request): Promise<Response> {
    const kind = kindSchema.safeParse(new URL(request.url).pathname.slice(1));
    if (!kind.success) return new Response("Unknown catalog", { status: 400 });
    const now = Date.now();
    if (request.method !== "POST") {
      await this.recordDemand(now);
      try { return Response.json(await this.refresh.get(kind.data)); }
      catch { return new Response("Catalog refresh failed; please retry", { status: 503 }); }
    }
    const failure = await this.ctx.storage.get<CatalogFailure>(failureKey(kind.data));
    const status = keepWarmDecision({ now, lastDemandAt: await this.lastDemandAt(), snapshot: this.refresh.peek(kind.data), failure });
    if (status === "deferred" && failure) {
      log("warn", "aero_catalog_refresh_deferred", { kind: kind.data, failures: failure.failures, stage: failure.stage, error_code: failure.code, retry_after: new Date(failure.notBefore).toISOString() });
    }
    if (status !== "refresh") return Response.json({ status });
    try {
      const snapshot = await this.refresh.get(kind.data, true);
      return Response.json({ status: "refreshed", expiresAt: snapshot.expiresAt });
    } catch {
      return Response.json({ status: "failed" }, { status: 503 });
    }
  }
}
