import { jsonValueSchema, type JsonInput, type JsonValue } from "../json-contract";
import { z } from "zod";
import { log } from "../logger";

const whopBankCurrencySchema = z.object({
  currency: z.string(),
  account_number: z.string().nullable(),
  routing_number: z.string().nullable(),
  deposit_bank_name: z.string().nullable(),
  deposit_bank_address: z.string().nullable(),
  deposit_beneficiary_name: z.string().nullable(),
  deposit_reference: z.string().nullable(),
  swift_bic: z.string().nullable(),
  rails: z.array(z.string()),
}).catchall(jsonValueSchema);

const whopCryptoSchema = z.object({
  name: z.string(),
  deposit_address: z.string().nullable(),
  icon_url: z.string().nullable(),
  supported_currencies: z.array(z.object({ name: z.string(), icon_url: z.string().nullable() }).catchall(jsonValueSchema)),
}).catchall(jsonValueSchema);

const whopDepositSchema = z.object({
  account_id: z.string().nullable(),
  amount: z.string().optional(),
  hosted_url: z.string().nullable(),
  methods: z.object({
    bank: z.object({ currencies: z.array(whopBankCurrencySchema) }).catchall(jsonValueSchema).nullable(),
    crypto: z.array(whopCryptoSchema).nullable(),
  }).catchall(jsonValueSchema),
}).catchall(jsonValueSchema);

export type WhopDeposit = z.output<typeof whopDepositSchema>;

const whopAccountSchema = z.object({ id: z.string().regex(/^biz_[A-Za-z0-9]+$/) }).catchall(jsonValueSchema);
export const whopWebhookSetupSchema = z.object({ accountId: z.string().regex(/^biz_[A-Za-z0-9]+$/) });
const webhookSchema = z.object({
  id: z.string().regex(/^hook_[A-Za-z0-9]+$/),
  url: z.string().url(),
  api_version_date: z.string().nullable(),
  child_resource_events: z.boolean(),
  enabled: z.boolean(),
  events: z.array(z.string()),
});

export class WhopService {
  constructor(
    private readonly config: Readonly<{ apiKey: string; apiUrl: string; apiVersionDate: string }>,
    private readonly request: typeof fetch = fetch,
  ) {}

  async createAccount(input: { email: string; title: string; metadata: Record<string, string>; idempotencyKey: string }): Promise<{ id: string }> {
    const body = await this.call("/accounts", {
      email: input.email,
      title: input.title,
      metadata: input.metadata,
      send_customer_emails: false,
    }, input.idempotencyKey);
    return { id: whopAccountSchema.parse(body).id };
  }

  async createDeposit(input: { destination: string; amount?: number; idempotencyKey: string }): Promise<WhopDeposit> {
    const body = await this.call("/deposits", {
      destination: input.destination,
      amount: input.amount,
    }, input.idempotencyKey);
    return whopDepositSchema.parse(body);
  }

  async configureWebhook(accountId: string, url: string) {
    whopWebhookSetupSchema.parse({ accountId });
    const listed = z.object({ data: z.array(webhookSchema), page_info: z.object({ has_next_page: z.boolean() }) }).parse(
      await this.call(`/webhooks?account_id=${encodeURIComponent(accountId)}&first=100`, undefined, undefined, "GET"),
    );
    const matching = listed.data.filter((hook) => hook.url === url);
    if (listed.page_info.has_next_page || matching.length !== 1) throw new Error("Expected exactly one existing Pecu webhook.");
    const hook = matching[0]!;
    const result = webhookSchema.parse(await this.call(`/webhooks/${hook.id}`, {
      api_version_date: this.config.apiVersionDate,
      child_resource_events: true,
      enabled: true,
      events: ["deposit.succeeded"],
    }, undefined, "PATCH"));
    if (result.url !== url || result.api_version_date !== this.config.apiVersionDate || !result.child_resource_events || !result.enabled || result.events.length !== 1 || result.events[0] !== "deposit.succeeded") {
      throw new Error("Whop did not retain the requested webhook configuration.");
    }
    return result;
  }

  private async call(path: string, payload: JsonInput, idempotencyKey?: string, method = "POST"): Promise<JsonValue> {
    const headers = new Headers({
      Authorization: `Bearer ${this.config.apiKey}`,
      "Api-Version-Date": this.config.apiVersionDate,
      "Content-Type": "application/json",
    });
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    const response = await this.request.call(globalThis, `${this.config.apiUrl}${path}`, {
      method,
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      log("warn", "whop_request_failed", { path, status: response.status });
      throw new Error(`Whop is unavailable right now (${response.status}).`);
    }
    return jsonValueSchema.parse(await response.json());
  }
}
