import { z } from "zod";
import type { WebSql } from "./web";

export const waitlistConsent = "launch-email-2026-10";
const attemptWindowMs = 10 * 60_000;
const attemptsPerWindow = 5;
const trackedClients = 5_000;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const waitlistJoinSchema = z.object({ email: emailSchema, consent: z.literal(true) }).strict();
export const waitlistRemoveSchema = z.object({ email: emailSchema }).strict();

export type WaitlistJoinInput = z.infer<typeof waitlistJoinSchema>;
export type WaitlistRemoveInput = z.infer<typeof waitlistRemoveSchema>;
export type WaitlistSignup = Readonly<{ email: string; consent: string; joinedAt: string }>;

export class PecuWaitlist {
  private readonly attempts = new Map<string, number[]>();

  constructor(private readonly sql: WebSql, private readonly now: () => number = Date.now) {
    sql.exec(`CREATE TABLE IF NOT EXISTS pecu_waitlist (
      email TEXT PRIMARY KEY CHECK(length(email) BETWEEN 3 AND 254),
      consent TEXT NOT NULL,
      joined_at INTEGER NOT NULL
    )`);
  }

  join(input: WaitlistJoinInput): void {
    this.sql.exec("INSERT INTO pecu_waitlist(email,consent,joined_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING", input.email, waitlistConsent, this.now());
  }

  list(): WaitlistSignup[] {
    return this.sql.exec<{ email: string; consent: string; joined_at: number }>("SELECT email,consent,joined_at FROM pecu_waitlist ORDER BY joined_at,email").toArray()
      .map((row) => ({ email: row.email, consent: row.consent, joinedAt: new Date(row.joined_at).toISOString() }));
  }

  remove(input: WaitlistRemoveInput): boolean {
    return this.sql.exec<{ email: string }>("DELETE FROM pecu_waitlist WHERE email=? RETURNING email", input.email).toArray().length === 1;
  }

  allow(client: string): boolean {
    const now = this.now();
    if (this.attempts.size >= trackedClients) {
      for (const [key, times] of this.attempts) if (times.at(-1)! <= now - attemptWindowMs) this.attempts.delete(key);
      if (this.attempts.size >= trackedClients) this.attempts.delete(this.attempts.keys().next().value!);
    }
    const recent = (this.attempts.get(client) ?? []).filter((time) => time > now - attemptWindowMs);
    if (recent.length >= attemptsPerWindow) return false;
    this.attempts.set(client, [...recent, now]);
    return true;
  }
}
