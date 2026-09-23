import { KNOWN_TOKENS } from "@beegreat/sugar";
import { concatHex, decodeFunctionData, encodeFunctionData, erc20Abi, getAddress, padHex, zeroAddress } from "viem";
import { z } from "zod";
import type { PecuAgent } from "./agent";
import { chatError, intentTitle } from "./chat";
import type { VerifiedMessage } from "./domain";
import { formatUnits, parseUnits, type EvmService } from "./evm";
import { decodeSafeBatch, safeExtensionAbi, safeTransactionSchema, type SafeReadCommand } from "./safe";
import { allowanceModule, moduleName, nativeToken, safeSigner, type SafeChain, type TokenInfo } from "./safe-chain";
import type {
  ProfileAction,
  ProfileActionResult,
  ProfileBalance,
  ProfileIntent,
  ProfileOverview,
  ProfileProposal,
  ProfileSafeDetail,
  SafeProposalAction,
} from "./safe-profile-contract";
import type { Intent, PecuStore } from "./state";
import type { WebSql } from "./web";
import { senderKind } from "./web-identity";

type Address = `0x${string}`;
type Identity = Readonly<{ userId: string; senderId: string }>;
type SafeTransaction = z.output<typeof safeTransactionSchema>;
type ProposalKind = ProfileProposal["kind"];
type IntentKind = ProfileIntent["kind"];

type OrgRow = { id: string; sender: string; name: string; created_at: number };
type WalletRow = { org_id: string; safe: string; name: string; created_at: number; creation_event: string | null };
type ContactRow = { org_id: string; address: string; name: string };
type ProposalRow = {
  hash: Address; safe: Address; nonce: string; kind: string; title: string; summary: string; tx: string; sender: string;
  created_at: number; created_block: string | null; submitted_tx: Address | null; submitted_at: number | null; executed_tx: Address | null; settled: string | null;
};
type SignatureRow = { hash: Address; owner: Address; data: Address };
type IntentRow = { event_id: string; sender: string; kind: string; safe: string; hash: string | null; request_id: string; code: string; created_at: number };

export class ProfileError extends Error {}

const limits = { orgs: 20, safes: 20, contacts: 100, queued: 100, queuedPerProposer: 10 };
const submissionWindowMs = 10 * 60_000;
const execTransactionSelector = "0x6a761202";
const recentIntentMs = 30 * 60_000;
const baseTokens: TokenInfo[] = [
  nativeToken,
  ...Object.values(KNOWN_TOKENS[8453]).filter((token) => token.tokenAddress !== "ETH").map((token) => ({ symbol: token.symbol, token: getAddress(token.tokenAddress), decimals: token.decimals })),
];
const proposalCommands = new Set<SafeReadCommand>([
  "safe-propose", "safe-cancel-propose", "safe-owner-propose", "safe-batch-propose", "safe-module-propose", "safe-budget-propose",
  "safe-budget-revoke-propose", "safe-role-grant-propose", "safe-role-revoke-propose", "safe-passkey-owner-propose", "safe-sponsored-enable-propose",
]);
const proposalKinds = new Set<string>(["send", "owner-add", "owner-remove", "owner-replace", "threshold", "reject", "budget-set", "budget-revoke", "other"]);
const intentKinds = new Set<string>(["create", "approve", "execute", "spend"]);
const codePattern = /\/(?:confirm|cancel) ([A-Z0-9]{6})\b/;
const txLinks = /https:\/\/basescan\.org\/tx\/(0x[0-9a-fA-F]{64})/g;

function checksum(value: string, label = "address"): Address {
  try {
    return getAddress(value);
  } catch {
    throw new ProfileError(`Check the ${label}. It isn't a valid Base address.`);
  }
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const approvedHashSignature = (owner: Address): Address => concatHex([padHex(owner, { size: 32 }), padHex("0x", { size: 32 }), "0x01"]);

function balanceView(token: TokenInfo & { amount: bigint }): ProfileBalance {
  return { symbol: token.symbol, token: token.token, decimals: token.decimals, amount: formatUnits(token.amount, token.decimals) };
}

function classify(transaction: SafeTransaction): ProposalKind {
  const data = transaction.data as Address;
  const self = same(transaction.to, transaction.safe);
  if (transaction.operation === 1) {
    try {
      const calls = decodeSafeBatch(data);
      return calls.some((call) => safeCall(call.data) === "setAllowance") ? "budget-set" : "other";
    } catch {
      return "other";
    }
  }
  if (data === "0x") return self && transaction.value === "0" ? "reject" : "send";
  const name = safeCall(data);
  if (self && name === "addOwnerWithThreshold") return "owner-add";
  if (self && name === "removeOwner") return "owner-remove";
  if (self && name === "swapOwner") return "owner-replace";
  if (self && name === "changeThreshold") return "threshold";
  if (name === "deleteAllowance") return "budget-revoke";
  try {
    if (decodeFunctionData({ abi: erc20Abi, data }).functionName === "transfer") return "send";
  } catch { /* Not an ERC-20 transfer. */ }
  return "other";
}

function safeCall(data: Address): string | undefined {
  try {
    return decodeFunctionData({ abi: safeExtensionAbi, data }).functionName;
  } catch {
    return undefined;
  }
}

function titleFor(kind: ProposalKind, summary: string): string {
  switch (kind) {
    case "send": return sentence(summary.replace(/ to 0x[0-9a-fA-F]{40}.*$/s, ""));
    case "owner-add": return "Add owner";
    case "owner-remove": return "Remove owner";
    case "owner-replace": return "Replace owner";
    case "threshold": return "Change required approvals";
    case "reject": return "Reject pending transactions";
    case "budget-set": return "Set spending limit";
    case "budget-revoke": return "Remove spending limit";
    case "other": return "Safe transaction";
  }
}

export type SafeProfileDeps = Readonly<{
  agent: Pick<PecuAgent, "proposeAction" | "handle">;
  store: Pick<PecuStore, "wallet" | "intentForSource">;
  evm: Pick<EvmService, "safeRead" | "describeSafeTransaction">;
  chain: Pick<SafeChain, "blockNumber" | "safeState" | "approvals" | "tokens" | "balances" | "budgets" | "execution" | "findExecution" | "transaction">;
  sql: WebSql;
}>;

export class SafeProfile {
  private readonly active = new Set<string>();

  constructor(private readonly deps: SafeProfileDeps) {
    const { sql } = deps;
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_orgs (id TEXT PRIMARY KEY, sender TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_safe_orgs_sender ON basedbot_safe_orgs(sender, created_at)");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_wallets (org_id TEXT NOT NULL, safe TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, creation_event TEXT, PRIMARY KEY(org_id, safe))");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_safe_wallets_safe ON basedbot_safe_wallets(safe)");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_contacts (org_id TEXT NOT NULL, address TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(org_id, address))");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_proposals (hash TEXT PRIMARY KEY, safe TEXT NOT NULL, nonce TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, tx TEXT NOT NULL, sender TEXT NOT NULL, created_at INTEGER NOT NULL, created_block TEXT, submitted_tx TEXT, submitted_at INTEGER, executed_tx TEXT, settled TEXT)");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_safe_proposals_safe ON basedbot_safe_proposals(safe, created_at)");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_signatures (hash TEXT NOT NULL, owner TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(hash, owner))");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_safe_intents (event_id TEXT PRIMARY KEY, sender TEXT NOT NULL, kind TEXT NOT NULL, safe TEXT NOT NULL, hash TEXT, request_id TEXT NOT NULL, code TEXT NOT NULL, created_at INTEGER NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_safe_intents_safe ON basedbot_safe_intents(safe, created_at)");
  }

  private conversation(identity: Identity): string {
    return `profile:${identity.userId}:${identity.senderId}`;
  }

  private message(identity: Identity, requestId: string, text = ""): VerifiedMessage {
    const conversationId = this.conversation(identity);
    return { eventId: `${conversationId}:${requestId}`, conversationId, senderId: identity.senderId, text, encodedEvent: "" };
  }

  private rows<Row extends Record<string, SqlStorageValue>>(query: string, ...bindings: SqlStorageValue[]): Row[] {
    return this.deps.sql.exec<Row>(query, ...bindings).toArray();
  }

  private wallet(senderId: string): Address | null {
    const address = this.deps.store.wallet(senderId)?.address;
    return address && /^0x[0-9a-fA-F]{40}$/.test(address) ? getAddress(address) : null;
  }

  private requireWallet(identity: Identity): void {
    if (senderKind(identity.senderId) === "x" && !this.wallet(identity.senderId)) throw new ProfileError("No Pecu wallet exists for this X account. Send /wallet to Pecu on X first.");
  }

  private org(identity: Identity, orgId: string): OrgRow {
    const org = this.rows<OrgRow>("SELECT * FROM basedbot_safe_orgs WHERE id=? AND sender=?", orgId, identity.senderId)[0];
    if (!org) throw new ProfileError("This organization no longer exists.");
    return org;
  }

  private tracked(identity: Identity, safe: string): WalletRow & { org_name: string } {
    const row = this.rows<WalletRow & { org_name: string }>(
      "SELECT w.*, o.name AS org_name FROM basedbot_safe_wallets w JOIN basedbot_safe_orgs o ON o.id=w.org_id WHERE o.sender=? AND w.safe=?",
      identity.senderId, checksum(safe),
    )[0];
    if (!row) throw new ProfileError("Add this Safe to one of your organizations first.");
    return row;
  }

  private proposal(identity: Identity, hash: string): ProposalRow {
    const row = this.rows<ProposalRow>("SELECT * FROM basedbot_safe_proposals WHERE hash=?", hash.toLowerCase())[0];
    if (!row) throw new ProfileError("This transaction is no longer in the queue.");
    this.tracked(identity, row.safe);
    return row;
  }

  private intentView(row: IntentRow): ProfileIntent | null {
    const intent = this.deps.store.intentForSource(row.event_id);
    if (!intent || !intentKinds.has(row.kind)) return null;
    const state = intent.state === "pending" && intent.expiresAt < Date.now() ? "expired" : intent.state;
    return {
      requestId: row.request_id,
      kind: row.kind as IntentKind,
      preview: {
        code: row.code,
        title: intentTitle(intent),
        text: intent.preview,
        state,
        expiresAt: intent.expiresAt,
        ...(intent.result !== undefined && (state === "succeeded" || state === "failed") ? { result: intent.result } : {}),
      },
    };
  }

  private visibleIntents(rows: readonly IntentRow[]): ProfileIntent[] {
    const now = Date.now();
    return rows.flatMap((row) => {
      const view = this.intentView(row);
      if (!view) return [];
      const live = view.preview.state === "pending" || view.preview.state === "executing";
      return live || now - row.created_at < recentIntentMs ? [view] : [];
    });
  }

  private creationIntent(row: WalletRow): Intent | undefined {
    return row.creation_event ? this.deps.store.intentForSource(row.creation_event) : undefined;
  }

  private creationStatus(row: WalletRow): ProfileSafeDetail["status"] {
    const intent = this.creationIntent(row);
    if (!intent) return "ready";
    if (intent.state === "succeeded") return "ready";
    if (intent.state === "executing" || (intent.state === "pending" && intent.expiresAt >= Date.now())) return "creating";
    return "not-created";
  }

  async overview(identity: Identity): Promise<ProfileOverview> {
    const wallet = this.wallet(identity.senderId);
    const orgs = this.rows<OrgRow>("SELECT * FROM basedbot_safe_orgs WHERE sender=? ORDER BY created_at", identity.senderId);
    const wallets = this.rows<WalletRow>(
      "SELECT w.* FROM basedbot_safe_wallets w JOIN basedbot_safe_orgs o ON o.id=w.org_id WHERE o.sender=? ORDER BY w.created_at",
      identity.senderId,
    );
    const contacts = this.rows<ContactRow>(
      "SELECT c.* FROM basedbot_safe_contacts c JOIN basedbot_safe_orgs o ON o.id=c.org_id WHERE o.sender=? ORDER BY c.name",
      identity.senderId,
    );
    let balances: ProfileBalance[] | null = null;
    if (wallet) {
      try {
        balances = (await this.deps.chain.balances(wallet, baseTokens)).map(balanceView);
      } catch {
        balances = null;
      }
    }
    return {
      wallet,
      senderKind: senderKind(identity.senderId),
      balances,
      orgs: orgs.map((org) => ({
        id: org.id,
        name: org.name,
        createdAt: org.created_at,
        safes: wallets.filter((row) => row.org_id === org.id).map((row) => ({ address: checksum(row.safe), name: row.name, status: this.creationStatus(row) })),
        contacts: contacts.filter((row) => row.org_id === org.id).map((row) => ({ address: checksum(row.address), name: row.name })),
      })),
    };
  }

  async safe(identity: Identity, address: string): Promise<ProfileSafeDetail> {
    const row = this.tracked(identity, address);
    const safe = checksum(row.safe);
    const wallet = this.wallet(identity.senderId);
    const contacts = this.rows<ContactRow>("SELECT * FROM basedbot_safe_contacts WHERE org_id=? ORDER BY name", row.org_id).map((contact) => ({ address: checksum(contact.address), name: contact.name }));
    const intentRows = this.rows<IntentRow>("SELECT * FROM basedbot_safe_intents WHERE safe=? AND sender=? ORDER BY created_at", safe, identity.senderId);
    const creationRow = row.creation_event ? intentRows.find((intent) => intent.event_id === row.creation_event) : undefined;
    const creation = creationRow ? this.intentView(creationRow) : null;
    const base = {
      address: safe,
      name: row.name,
      org: { id: row.org_id, name: row.org_name },
      creation,
      wallet,
      contacts,
      observedAt: Date.now(),
    };
    let status = this.creationStatus(row);
    const state = status === "not-created" ? { deployed: false as const } : await this.deps.chain.safeState(safe);
    if (!state.deployed) {
      const planned = this.creationIntent(row);
      const parameters = planned?.family === "evm" && planned.action === "safe_create" ? planned.parameters : undefined;
      if (status === "ready") status = creationRow ? "creating" : "not-created";
      return {
        ...base,
        status,
        owners: parameters && "owners" in parameters ? parameters.owners.map((owner) => checksum(owner)) : [],
        threshold: parameters && "threshold" in parameters ? parameters.threshold : 0,
        nonce: "0",
        modules: [],
        balances: [],
        queue: [],
        history: [],
        budgets: [],
        intents: this.visibleIntents(intentRows.filter((intent) => intent.hash === null && intent.event_id !== row.creation_event)),
      };
    }
    const nonce = BigInt(state.nonce);
    const proposals = this.rows<ProposalRow>("SELECT * FROM basedbot_safe_proposals WHERE safe=? ORDER BY created_at DESC LIMIT 200", safe);
    const queued = await this.checkSubmissions(proposals.filter((proposal) => BigInt(proposal.nonce) >= nonce).reverse());
    const closed: ProposalRow[] = [];
    let settling = 0;
    for (const proposal of proposals.filter((candidate) => BigInt(candidate.nonce) < nonce).slice(0, 50)) {
      closed.push(proposal.settled || settling++ >= 10 ? proposal : await this.settle(proposal));
    }
    const [balances, approvals, budgets] = await Promise.all([
      this.deps.chain.balances(safe, baseTokens),
      this.deps.chain.approvals(safe, state.owners, queued.map((proposal) => proposal.hash)),
      state.modules.some((module) => same(module, allowanceModule)) ? this.budgets(safe) : Promise.resolve([]),
    ]);
    const signatures = queued.length
      ? this.rows<SignatureRow>(`SELECT hash, owner, data FROM basedbot_safe_signatures WHERE hash IN (${queued.map(() => "?").join(",")})`, ...queued.map((proposal) => proposal.hash))
      : [];
    const owners = new Set(state.owners.map((owner) => owner.toLowerCase()));
    const view = (proposal: ProposalRow, live: boolean): ProfileProposal => {
      const onChain = live ? approvals.get(proposal.hash) ?? [] : [];
      const signed = live ? signatures.filter((signature) => signature.hash === proposal.hash && owners.has(signature.owner.toLowerCase())) : [];
      const approvalList = [
        ...onChain.map((owner) => ({ owner, via: "chain" as const })),
        ...signed.filter((signature) => !onChain.some((owner) => same(owner, signature.owner))).map((signature) => ({ owner: checksum(signature.owner), via: "signature" as const })),
      ];
      return {
        hash: proposal.hash,
        nonce: proposal.nonce,
        title: proposal.title,
        summary: proposal.summary,
        kind: proposalKinds.has(proposal.kind) ? proposal.kind as ProposalKind : "other",
        createdAt: proposal.created_at,
        proposer: proposal.sender === identity.senderId ? "you" : owners.has(this.wallet(proposal.sender)?.toLowerCase() ?? "") ? "owner" : "other",
        transaction: safeTransactionSchema.parse(JSON.parse(proposal.tx)),
        approvals: approvalList,
        signatures: signed.map((signature) => ({ owner: checksum(signature.owner), data: signature.data })),
        state: live
          ? proposal.submitted_tx ? "submitted" : "queued"
          : proposal.settled === "executed" ? "executed" : proposal.settled === "replaced" ? "replaced" : "closed",
        executedTransaction: live ? proposal.submitted_tx : proposal.executed_tx,
        intents: live ? this.visibleIntents(intentRows.filter((intent) => intent.hash === proposal.hash)) : [],
      };
    };
    return {
      ...base,
      status: "ready",
      owners: state.owners,
      threshold: state.threshold,
      nonce: state.nonce,
      modules: state.modules.map((module) => ({ address: module, name: moduleName(module) })),
      balances: balances.map(balanceView),
      queue: queued.map((proposal) => view(proposal, true)),
      history: closed.map((proposal) => view(proposal, false)),
      budgets,
      intents: this.visibleIntents(intentRows.filter((intent) => intent.hash === null && intent.event_id !== row.creation_event)),
    };
  }

  private async budgets(safe: Address): Promise<ProfileSafeDetail["budgets"]> {
    const budgets = await this.deps.chain.budgets(safe);
    const tokens = [...new Set(budgets.map((budget) => budget.token).filter((token) => token !== zeroAddress))];
    const info = await this.deps.chain.tokens(tokens);
    return budgets.flatMap((budget) => {
      const token = budget.token === zeroAddress ? nativeToken : info.get(budget.token.toLowerCase());
      if (!token) return [];
      const remaining = budget.amount > budget.spent ? budget.amount - budget.spent : 0n;
      return [{
        delegate: budget.delegate,
        token: budget.token,
        symbol: token.symbol,
        decimals: token.decimals,
        amount: formatUnits(budget.amount, token.decimals),
        spent: formatUnits(budget.spent, token.decimals),
        remaining: formatUnits(remaining, token.decimals),
        resetMinutes: budget.resetMinutes,
      }];
    });
  }

  private async checkSubmissions(rows: ProposalRow[]): Promise<ProposalRow[]> {
    return Promise.all(rows.map(async (row) => {
      if (!row.submitted_tx) return row;
      try {
        const check = await this.deps.chain.execution(row.safe, row.submitted_tx, row.hash);
        const stale = check === "pending" && Date.now() - (row.submitted_at ?? 0) > submissionWindowMs && !await this.deps.chain.transaction(row.submitted_tx);
        if (check !== "failed" && check !== "unrelated" && !stale) return row;
      } catch {
        return row;
      }
      this.deps.sql.exec("UPDATE basedbot_safe_proposals SET submitted_tx=NULL, submitted_at=NULL WHERE hash=?", row.hash);
      return { ...row, submitted_tx: null, submitted_at: null };
    }));
  }

  private async settle(row: ProposalRow): Promise<ProposalRow> {
    if (row.settled) return row;
    const safe = row.safe;
    const hash = row.hash;
    const candidates = new Set<Address>(row.submitted_tx ? [row.submitted_tx] : []);
    for (const intent of this.rows<IntentRow>("SELECT * FROM basedbot_safe_intents WHERE hash=? AND kind='execute'", row.hash)) {
      const stored = this.deps.store.intentForSource(intent.event_id);
      if (stored?.state === "succeeded") for (const match of (stored.result ?? "").matchAll(txLinks)) candidates.add(`0x${match[1]!.slice(2)}`);
    }
    try {
      let executed: Address | null = null;
      for (const candidate of candidates) {
        if (await this.deps.chain.execution(safe, candidate, hash) === "executed") {
          executed = candidate;
          break;
        }
      }
      executed ??= await this.deps.chain.findExecution(safe, hash, row.created_block ?? "0");
      const settled = executed ? "executed" : "replaced";
      this.deps.sql.exec("UPDATE basedbot_safe_proposals SET settled=?, executed_tx=? WHERE hash=?", settled, executed, row.hash);
      return { ...row, settled, executed_tx: executed };
    } catch {
      return row;
    }
  }

  async act(identity: Identity, action: ProfileAction): Promise<ProfileActionResult> {
    switch (action.op) {
      case "org-create": {
        const count = this.rows<{ count: number }>("SELECT COUNT(*) AS count FROM basedbot_safe_orgs WHERE sender=?", identity.senderId)[0]?.count ?? 0;
        if (count >= limits.orgs) throw new ProfileError(`You can have up to ${limits.orgs} organizations.`);
        const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("");
        this.deps.sql.exec("INSERT INTO basedbot_safe_orgs(id,sender,name,created_at) VALUES(?,?,?,?)", id, identity.senderId, action.name, Date.now());
        return { ok: true, orgId: id };
      }
      case "org-rename":
        this.org(identity, action.orgId);
        this.deps.sql.exec("UPDATE basedbot_safe_orgs SET name=? WHERE id=?", action.name, action.orgId);
        return { ok: true, orgId: action.orgId };
      case "org-delete": {
        this.org(identity, action.orgId);
        const wallets = this.rows<WalletRow>("SELECT * FROM basedbot_safe_wallets WHERE org_id=?", action.orgId);
        if (wallets.some((row) => this.creationStatus(row) === "creating")) throw new ProfileError("Wait for the Safe that is being created to finish, or cancel it, before deleting this organization.");
        this.deps.sql.exec("DELETE FROM basedbot_safe_wallets WHERE org_id=?", action.orgId);
        this.deps.sql.exec("DELETE FROM basedbot_safe_contacts WHERE org_id=?", action.orgId);
        this.deps.sql.exec("DELETE FROM basedbot_safe_orgs WHERE id=?", action.orgId);
        return { ok: true };
      }
      case "contact-save": {
        this.org(identity, action.orgId);
        const address = checksum(action.address);
        const count = this.rows<{ count: number }>("SELECT COUNT(*) AS count FROM basedbot_safe_contacts WHERE org_id=?", action.orgId)[0]?.count ?? 0;
        if (count >= limits.contacts) throw new ProfileError(`An organization can have up to ${limits.contacts} saved names.`);
        this.deps.sql.exec("INSERT INTO basedbot_safe_contacts(org_id,address,name) VALUES(?,?,?) ON CONFLICT(org_id,address) DO UPDATE SET name=excluded.name", action.orgId, address, action.name);
        return { ok: true, orgId: action.orgId };
      }
      case "contact-delete":
        this.org(identity, action.orgId);
        this.deps.sql.exec("DELETE FROM basedbot_safe_contacts WHERE org_id=? AND address=?", action.orgId, checksum(action.address));
        return { ok: true, orgId: action.orgId };
      case "safe-add": {
        this.org(identity, action.orgId);
        const safe = checksum(action.safe, "Safe address");
        this.assertUntracked(identity, safe);
        try {
          await this.deps.evm.safeRead("safe-info", { safe });
        } catch (error) {
          throw new ProfileError(`This address isn't a supported Safe on Base. ${error instanceof Error ? error.message : ""}`.trim());
        }
        this.insertWallet(action.orgId, safe, action.name, null);
        return { ok: true, orgId: action.orgId, safe };
      }
      case "safe-create":
        return this.createSafe(identity, action);
      case "safe-rename": {
        const row = this.tracked(identity, action.safe);
        this.deps.sql.exec("UPDATE basedbot_safe_wallets SET name=? WHERE org_id=? AND safe=?", action.name, row.org_id, row.safe);
        return { ok: true, safe: checksum(row.safe) };
      }
      case "safe-remove": {
        const row = this.tracked(identity, action.safe);
        if (this.creationStatus(row) === "creating") throw new ProfileError("This Safe is still being created. Cancel the creation first, or wait for it to finish.");
        this.deps.sql.exec("DELETE FROM basedbot_safe_wallets WHERE org_id=? AND safe=?", row.org_id, row.safe);
        return { ok: true, orgId: row.org_id };
      }
      case "proposal-create":
        return this.createProposal(identity, action.safe, action.action);
      case "proposal-delete": {
        const row = this.proposal(identity, action.hash);
        if (row.sender !== identity.senderId) throw new ProfileError("Only the owner who proposed this transaction can remove it.");
        const state = await this.liveState(row.safe);
        if (BigInt(row.nonce) < BigInt(state.nonce)) throw new ProfileError("This transaction is no longer pending.");
        this.deps.sql.exec("DELETE FROM basedbot_safe_signatures WHERE hash=?", row.hash);
        this.deps.sql.exec("DELETE FROM basedbot_safe_proposals WHERE hash=?", row.hash);
        return { ok: true };
      }
      case "proposal-sign": {
        const row = this.proposal(identity, action.hash);
        const state = await this.liveState(row.safe);
        if (row.nonce !== state.nonce) throw new ProfileError("This transaction is no longer pending.");
        const owner = checksum(action.owner);
        if (!state.owners.some((candidate) => same(candidate, owner))) throw new ProfileError("This wallet isn't an owner of the Safe.");
        const { signer, signature } = await safeSigner(row.hash, action.signature);
        if (!same(signer, owner)) throw new ProfileError("The signature doesn't match this transaction and wallet. Sign again.");
        this.deps.sql.exec("INSERT INTO basedbot_safe_signatures(hash,owner,data,created_at) VALUES(?,?,?,?) ON CONFLICT(hash,owner) DO UPDATE SET data=excluded.data", row.hash, owner, signature, Date.now());
        return { ok: true, proposal: row.hash };
      }
      case "proposal-approve": {
        const row = this.proposal(identity, action.hash);
        this.requireWallet(identity);
        const transaction = safeTransactionSchema.parse(JSON.parse(row.tx));
        return this.propose(identity, action.requestId, "approve", row.safe, row.hash, "safe_approve", { transaction });
      }
      case "proposal-execute":
        return this.execute(identity, action.requestId, action.hash);
      case "proposal-submitted": {
        const row = this.proposal(identity, action.hash);
        const sent = await this.deps.chain.transaction(action.transaction);
        if (sent && (!sent.to || !same(sent.to, row.safe) || !sent.input.toLowerCase().startsWith(execTransactionSelector))) throw new ProfileError("That transaction doesn't execute this Safe transaction.");
        this.deps.sql.exec("UPDATE basedbot_safe_proposals SET submitted_tx=?, submitted_at=? WHERE hash=? AND settled IS NULL", action.transaction, Date.now(), row.hash);
        return { ok: true, proposal: row.hash };
      }
      case "budget-spend": {
        const row = this.tracked(identity, action.safe);
        this.requireWallet(identity);
        const token = await this.token(action.token);
        const amount = parseUnits(action.amount, token.decimals);
        if (amount <= 0n) throw new ProfileError("Enter an amount greater than zero.");
        return this.propose(identity, action.requestId, "spend", checksum(row.safe), null, "safe_budget_spend", {
          safe: checksum(row.safe), token: token.token ?? zeroAddress, to: checksum(action.to, "recipient"), amount: amount.toString(),
        });
      }
      case "intent-confirm":
      case "intent-cancel": {
        const row = this.rows<IntentRow>("SELECT * FROM basedbot_safe_intents WHERE sender=? AND code=?", identity.senderId, action.code)
          .find((candidate) => candidate.event_id.startsWith(`${this.conversation(identity)}:`));
        if (!row) throw new ProfileError("This confirmation is no longer available.");
        const message = this.message(identity, action.requestId, `/${action.op === "intent-confirm" ? "confirm" : "cancel"} ${action.code}`);
        const reply = await this.deps.agent.handle(message);
        const intent = this.intentView(row) ?? undefined;
        return { ok: true, ...(intent ? { intent } : {}), message: reply ?? "Pecu is still working on the previous request. Try again in a moment." };
      }
      default: {
        const _exhaustive: never = action;
        throw new ProfileError(`Unsupported action ${String(_exhaustive)}`);
      }
    }
  }

  async shareProposal(senderId: string, command: SafeReadCommand, output: unknown): Promise<void> {
    if (!proposalCommands.has(command)) return;
    const parsed = safeTransactionSchema.safeParse(output);
    if (!parsed.success) return;
    const transaction = parsed.data;
    const kind = classify(transaction);
    let summary: string;
    try {
      summary = sentence(await this.deps.evm.describeSafeTransaction(transaction));
    } catch {
      summary = `Call ${transaction.to}`;
    }
    await this.saveProposal(senderId, transaction, kind, titleFor(kind, summary), summary);
  }

  private assertUntracked(identity: Identity, safe: Address): void {
    const existing = this.rows<{ name: string }>(
      "SELECT o.name FROM basedbot_safe_wallets w JOIN basedbot_safe_orgs o ON o.id=w.org_id WHERE o.sender=? AND w.safe=?",
      identity.senderId, safe,
    )[0];
    if (existing) throw new ProfileError(`This Safe is already in ${existing.name}.`);
  }

  private insertWallet(orgId: string, safe: Address, name: string, creationEvent: string | null): void {
    const count = this.rows<{ count: number }>("SELECT COUNT(*) AS count FROM basedbot_safe_wallets WHERE org_id=?", orgId)[0]?.count ?? 0;
    if (count >= limits.safes) throw new ProfileError(`An organization can have up to ${limits.safes} Safes.`);
    this.deps.sql.exec("INSERT INTO basedbot_safe_wallets(org_id,safe,name,created_at,creation_event) VALUES(?,?,?,?,?)", orgId, safe, name, Date.now(), creationEvent);
  }

  private async liveState(safe: Address) {
    const state = await this.deps.chain.safeState(safe);
    if (!state.deployed) throw new ProfileError("This Safe isn't deployed on Base yet.");
    return state;
  }

  private async token(reference: string): Promise<TokenInfo> {
    if (same(reference, zeroAddress)) return nativeToken;
    const known = baseTokens.find((token) => token.symbol === reference || (token.token !== null && same(token.token, reference)));
    if (known) return known;
    const address = checksum(reference, "token address");
    const info = (await this.deps.chain.tokens([address])).get(address.toLowerCase());
    if (!info) throw new ProfileError("This address isn't a token on Base.");
    return info;
  }

  private async createSafe(identity: Identity, action: Extract<ProfileAction, { op: "safe-create" }>): Promise<ProfileActionResult> {
    this.org(identity, action.orgId);
    this.requireWallet(identity);
    const owners = action.owners.map((owner) => checksum(owner, "owner address"));
    if (new Set(owners).size !== owners.length) throw new ProfileError("Each owner can appear only once.");
    if (action.threshold > owners.length) throw new ProfileError("Required approvals can't be more than the number of owners.");
    const saltNonce = BigInt(`0x${crypto.randomUUID().replaceAll("-", "")}`).toString();
    const result = await this.propose(identity, action.requestId, "create", null, null, "safe_create", { owners, threshold: action.threshold, saltNonce }, (context, eventId) => {
      const safe = checksum(z.string().parse(context.safe));
      this.assertUntracked(identity, safe);
      this.insertWallet(action.orgId, safe, action.name, eventId);
      return safe;
    });
    return { ...result, orgId: action.orgId };
  }

  private async propose(
    identity: Identity,
    requestId: string,
    kind: IntentKind,
    safe: Address | null,
    hash: Address | null,
    action: "safe_create" | "safe_approve" | "safe_execute_signatures" | "safe_budget_spend",
    parameters: Record<string, unknown>,
    onPlanned?: (context: Readonly<Record<string, unknown>>, eventId: string) => Address,
  ): Promise<ProfileActionResult> {
    const message = this.message(identity, requestId);
    const existing = this.rows<IntentRow>("SELECT * FROM basedbot_safe_intents WHERE event_id=?", message.eventId)[0];
    if (existing) {
      const intent = this.intentView(existing);
      return { ok: true, safe: checksum(existing.safe), ...(intent ? { intent } : {}) };
    }
    if (this.active.has(message.eventId)) throw new ProfileError("This request is already being prepared.");
    this.active.add(message.eventId);
    try {
      let planned;
      try {
        planned = await this.deps.agent.proposeAction(message, action, parameters);
      } catch (error) {
        throw new ProfileError(chatError(error).replace(/^Could not process that command: /, ""));
      }
      const code = codePattern.exec(planned.text)?.[1];
      if (!code || !this.deps.store.intentForSource(message.eventId)) return { ok: true, message: planned.text };
      const target = onPlanned ? onPlanned(planned.context, message.eventId) : safe;
      if (!target) throw new ProfileError("The Safe for this request is missing.");
      this.deps.sql.exec(
        "INSERT INTO basedbot_safe_intents(event_id,sender,kind,safe,hash,request_id,code,created_at) VALUES(?,?,?,?,?,?,?,?)",
        message.eventId, identity.senderId, kind, target, hash, requestId, code, Date.now(),
      );
      const row = this.rows<IntentRow>("SELECT * FROM basedbot_safe_intents WHERE event_id=?", message.eventId)[0]!;
      const intent = this.intentView(row);
      return { ok: true, safe: target, ...(hash ? { proposal: hash } : {}), ...(intent ? { intent } : {}), message: planned.text };
    } finally {
      this.active.delete(message.eventId);
    }
  }

  private executionSignatures(state: { owners: Address[]; threshold: number }, executor: Address | null, onChain: readonly Address[], signatures: readonly SignatureRow[]) {
    const chosen = new Map<string, { owner: Address; data: Address; contract: false }>();
    const add = (owner: Address, data: Address) => {
      if (chosen.size < state.threshold && !chosen.has(owner.toLowerCase()) && state.owners.some((candidate) => same(candidate, owner))) {
        chosen.set(owner.toLowerCase(), { owner, data, contract: false });
      }
    };
    if (executor) add(executor, approvedHashSignature(executor));
    for (const owner of onChain) add(owner, approvedHashSignature(owner));
    for (const signature of signatures) add(checksum(signature.owner), signature.data);
    return { signatures: [...chosen.values()], missing: Math.max(state.threshold - chosen.size, 0) };
  }

  private async execute(identity: Identity, requestId: string, hash: string): Promise<ProfileActionResult> {
    const row = this.proposal(identity, hash);
    this.requireWallet(identity);
    const safe = row.safe;
    const transaction = safeTransactionSchema.parse(JSON.parse(row.tx));
    const state = await this.liveState(safe);
    if (row.nonce !== state.nonce) throw new ProfileError("This transaction is no longer pending.");
    const onChain = (await this.deps.chain.approvals(safe, state.owners, [row.hash])).get(row.hash) ?? [];
    const signatures = this.rows<SignatureRow>("SELECT hash, owner, data FROM basedbot_safe_signatures WHERE hash=?", row.hash);
    const plan = this.executionSignatures(state, this.wallet(identity.senderId), onChain, signatures);
    if (plan.missing) throw new ProfileError(`This transaction needs ${plan.missing} more ${plan.missing === 1 ? "approval" : "approvals"} before it can run.`);
    return this.propose(identity, requestId, "execute", safe, row.hash, "safe_execute_signatures", { transaction, signatures: plan.signatures });
  }

  async pending(senderId: string, address: string) {
    const safe = checksum(address, "Safe address");
    const state = await this.liveState(safe);
    const rows = this.rows<ProposalRow>("SELECT * FROM basedbot_safe_proposals WHERE safe=? ORDER BY created_at", safe).filter((row) => row.nonce === state.nonce);
    const approvals = await this.deps.chain.approvals(safe, state.owners, rows.map((row) => row.hash));
    const wallet = this.wallet(senderId);
    return {
      safe,
      owners: state.owners,
      threshold: state.threshold,
      nonce: state.nonce,
      pending: rows.map((row) => {
        const transaction = safeTransactionSchema.parse(JSON.parse(row.tx));
        const onChain = approvals.get(row.hash) ?? [];
        const signatures = this.rows<SignatureRow>("SELECT hash, owner, data FROM basedbot_safe_signatures WHERE hash=?", row.hash)
          .filter((signature) => state.owners.some((owner) => same(owner, signature.owner)));
        const plan = this.executionSignatures(state, wallet, onChain, signatures);
        return {
          title: row.title,
          summary: row.summary,
          transaction,
          approvedOnChain: onChain,
          signedOnWeb: signatures.map((signature) => checksum(signature.owner)),
          ...(plan.missing ? { approvalsStillNeeded: plan.missing } : { executeWith: { transaction, signatures: plan.signatures } }),
        };
      }),
    };
  }

  private async createProposal(identity: Identity, address: string, action: SafeProposalAction): Promise<ProfileActionResult> {
    const row = this.tracked(identity, address);
    const safe = checksum(row.safe);
    const state = await this.liveState(safe);
    const queued = this.rows<{ sender: string }>("SELECT sender FROM basedbot_safe_proposals WHERE safe=? AND CAST(nonce AS INTEGER) >= ?", safe, Number(state.nonce));
    if (queued.length >= limits.queued) throw new ProfileError("This Safe's queue is full. Execute or remove a pending transaction first.");
    if (queued.filter((row) => row.sender === identity.senderId).length >= limits.queuedPerProposer) throw new ProfileError(`You can have up to ${limits.queuedPerProposer} pending transactions on one Safe. Remove one first.`);
    const read = async (command: SafeReadCommand, input: Record<string, unknown>) => {
      try {
        return safeTransactionSchema.parse((await this.deps.evm.safeRead(command, { safe, ...input })).output);
      } catch (error) {
        throw new ProfileError(chatError(error).replace(/^Could not process that command: /, ""));
      }
    };
    let transaction: SafeTransaction;
    let summary: string | undefined;
    switch (action.kind) {
      case "send": {
        const token = await this.token(action.token);
        const to = checksum(action.to, "recipient");
        if (same(to, safe)) throw new ProfileError("Choose a recipient other than this Safe.");
        const amount = parseUnits(action.amount, token.decimals);
        if (amount <= 0n) throw new ProfileError("Enter an amount greater than zero.");
        transaction = token.token === null
          ? await read("safe-propose", { to, value: amount.toString(), data: "0x" })
          : await read("safe-propose", { to: token.token, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] }) });
        summary = `Send ${formatUnits(amount, token.decimals)} ${token.symbol} to ${to}`;
        break;
      }
      case "owner-add":
        transaction = await read("safe-owner-propose", { change: { kind: "add", owner: checksum(action.owner, "owner address"), threshold: action.threshold } });
        break;
      case "owner-remove":
        transaction = await read("safe-owner-propose", { change: { kind: "remove", owner: checksum(action.owner, "owner address"), threshold: action.threshold } });
        break;
      case "owner-replace":
        transaction = await read("safe-owner-propose", { change: { kind: "replace", owner: checksum(action.owner, "owner address"), replacement: checksum(action.replacement, "new owner address") } });
        break;
      case "threshold":
        transaction = await read("safe-owner-propose", { change: { kind: "threshold", threshold: action.threshold } });
        break;
      case "reject":
        transaction = await read("safe-cancel-propose", {});
        break;
      case "budget-set": {
        const token = await this.token(action.token);
        const amount = parseUnits(action.amount, token.decimals);
        if (amount <= 0n || amount >= 2n ** 96n) throw new ProfileError("Enter a spending limit greater than zero.");
        transaction = await read("safe-budget-propose", { delegate: checksum(action.delegate, "spender address"), token: token.token ?? zeroAddress, amount: amount.toString(), resetMinutes: action.resetMinutes });
        break;
      }
      case "budget-revoke":
        transaction = await read("safe-budget-revoke-propose", { delegate: checksum(action.delegate, "spender address"), token: checksum(action.token, "token address") });
        break;
    }
    if (!same(transaction.safe, safe)) throw new ProfileError("The proposal belongs to a different Safe.");
    if (summary === undefined) {
      try {
        summary = sentence(await this.deps.evm.describeSafeTransaction(transaction));
      } catch (error) {
        throw new ProfileError(error instanceof Error ? error.message : "Pecu couldn't describe this transaction.");
      }
    }
    await this.saveProposal(identity.senderId, transaction, action.kind, titleFor(action.kind, summary), summary);
    return { ok: true, safe, proposal: transaction.hash };
  }

  private async saveProposal(senderId: string, transaction: SafeTransaction, kind: ProposalKind, title: string, summary: string): Promise<void> {
    let block: string | null = null;
    try {
      block = await this.deps.chain.blockNumber();
    } catch {
      block = null;
    }
    this.deps.sql.exec(
      "INSERT OR IGNORE INTO basedbot_safe_proposals(hash,safe,nonce,kind,title,summary,tx,sender,created_at,created_block) VALUES(?,?,?,?,?,?,?,?,?,?)",
      transaction.hash.toLowerCase(), checksum(transaction.safe), transaction.nonce, kind, title, summary, JSON.stringify(transaction), senderId, Date.now(), block,
    );
  }
}
