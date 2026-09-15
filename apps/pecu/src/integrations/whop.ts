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
}).passthrough();

const whopCryptoSchema = z.object({
  name: z.string(),
  deposit_address: z.string().nullable(),
  icon_url: z.string().nullable(),
  supported_currencies: z.array(z.object({ name: z.string(), icon_url: z.string().nullable() }).passthrough()),
}).passthrough();

const whopDepositSchema = z.object({
  account_id: z.string().nullable(),
  amount: z.string().optional(),
  hosted_url: z.string().nullable(),
  methods: z.object({
    bank: z.object({ currencies: z.array(whopBankCurrencySchema) }).passthrough().nullable(),
    crypto: z.array(whopCryptoSchema).nullable(),
  }).passthrough(),
}).passthrough();

export type WhopDeposit = z.output<typeof whopDepositSchema>;

const whopAccountSchema = z.object({ id: z.string().regex(/^biz_[A-Za-z0-9]+$/) }).passthrough();

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
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
    }, input.idempotencyKey);
    return whopDepositSchema.parse(body);
  }

  private async call(path: string, payload: unknown, idempotencyKey: string): Promise<unknown> {
    const response = await this.request.call(globalThis, `${this.config.apiUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Api-Version-Date": this.config.apiVersionDate,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      log("warn", "whop_request_failed", { path, status: response.status });
      throw new Error(`Whop is unavailable right now (${response.status}).`);
    }
    return response.json();
  }
}
