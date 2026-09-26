import { getAddress, recoverMessageAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { linkedWalletLimit, type LinkedWallet } from "./linked-wallet-contract";
import type { WebSql } from "./web";

type Address = `0x${string}`;
type WalletRow = { address: string; name: string | null; linked_at: number };
type ChallengeRow = { sender: string; address: string; message: string; expires_at: number };

const challengeTtlMs = 5 * 60_000;
const statement = "Link this wallet to your Pecu account. Signing is free and does not send a transaction.";

/** A refusal whose message is safe to show to the person who asked. */
export class LinkedWalletError extends Error {}

function checksum(value: string): Address {
  try {
    return getAddress(value);
  } catch {
    throw new LinkedWalletError("Connect a valid wallet address and try again.");
  }
}

/**
 * Wallets a Pecu account controls besides its Pecu (Crossmint) wallet. Each
 * one is linked only after it signs a short-lived Sign-In with Ethereum
 * message bound to this account, the page's domain and Base. Pecu stores the
 * public address, never keys or wallet sessions. Signature recovery only
 * accepts accounts that sign with their own key (EOAs).
 */
export class LinkedWallets {
  constructor(private readonly sql: WebSql) {
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_linked_wallets (sender TEXT NOT NULL, address TEXT NOT NULL, name TEXT, linked_at INTEGER NOT NULL, PRIMARY KEY(sender, address))");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_wallet_link_challenges (id TEXT PRIMARY KEY, sender TEXT NOT NULL, address TEXT NOT NULL, message TEXT NOT NULL, expires_at INTEGER NOT NULL)");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_wallet_link_challenges_sender ON basedbot_wallet_link_challenges(sender)");
    sql.exec("CREATE TABLE IF NOT EXISTS basedbot_chat_signers (sender TEXT NOT NULL, conversation TEXT NOT NULL, address TEXT NOT NULL, PRIMARY KEY(sender, conversation))");
  }

  private rows<Row extends Record<string, SqlStorageValue>>(query: string, ...bindings: SqlStorageValue[]): Row[] {
    return this.sql.exec<Row>(query, ...bindings).toArray();
  }

  list(senderId: string): LinkedWallet[] {
    return this.rows<WalletRow>("SELECT address,name,linked_at FROM basedbot_linked_wallets WHERE sender=? ORDER BY linked_at", senderId)
      .map((row) => ({ address: checksum(row.address), name: row.name, linkedAt: row.linked_at }));
  }

  isLinked(senderId: string, address: string): boolean {
    return this.rows("SELECT 1 AS linked FROM basedbot_linked_wallets WHERE sender=? AND address=?", senderId, checksum(address)).length > 0;
  }

  challenge(senderId: string, address: string, origin: string) {
    const wallet = checksum(address);
    if (this.isLinked(senderId, wallet)) throw new LinkedWalletError("This wallet is already linked to your account.");
    if (this.list(senderId).length >= linkedWalletLimit) throw new LinkedWalletError(`You can link up to ${linkedWalletLimit} wallets. Unlink one first.`);
    const page = new URL(origin);
    const now = Date.now();
    const expiresAt = now + challengeTtlMs;
    const challenge = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const message = createSiweMessage({
      domain: page.host,
      address: wallet,
      statement,
      uri: page.origin,
      version: "1",
      chainId: 8453,
      nonce: challenge,
      issuedAt: new Date(now),
      expirationTime: new Date(expiresAt),
    });
    this.sql.exec("DELETE FROM basedbot_wallet_link_challenges WHERE sender=? OR expires_at<?", senderId, now);
    this.sql.exec("INSERT INTO basedbot_wallet_link_challenges(id,sender,address,message,expires_at) VALUES(?,?,?,?,?)", challenge, senderId, wallet, message, expiresAt);
    return { challenge, message, expiresAt };
  }

  /** Verify the signed challenge once. A used, expired or foreign challenge never links a wallet. */
  async link(senderId: string, challenge: string, signature: `0x${string}`): Promise<LinkedWallet[]> {
    const row = this.rows<ChallengeRow>("SELECT sender,address,message,expires_at FROM basedbot_wallet_link_challenges WHERE id=?", challenge)[0];
    if (!row || row.sender !== senderId) throw new LinkedWalletError("This link request is no longer available. Try again.");
    this.sql.exec("DELETE FROM basedbot_wallet_link_challenges WHERE id=?", challenge);
    if (row.expires_at < Date.now()) throw new LinkedWalletError("This link request expired. Try again.");
    let signer: Address;
    try {
      signer = await recoverMessageAddress({ message: row.message, signature });
    } catch {
      throw new LinkedWalletError("Pecu couldn't read that signature. Try again with the same wallet.");
    }
    if (signer.toLowerCase() !== row.address.toLowerCase()) {
      throw new LinkedWalletError("That signature doesn't come from this wallet. Pecu links wallets that sign with their own key.");
    }
    if (this.list(senderId).length >= linkedWalletLimit) throw new LinkedWalletError(`You can link up to ${linkedWalletLimit} wallets. Unlink one first.`);
    this.sql.exec("INSERT INTO basedbot_linked_wallets(sender,address,name,linked_at) VALUES(?,?,NULL,?) ON CONFLICT(sender,address) DO NOTHING", senderId, checksum(row.address), Date.now());
    return this.list(senderId);
  }

  rename(senderId: string, address: string, name: string): LinkedWallet[] {
    const wallet = this.require(senderId, address);
    this.sql.exec("UPDATE basedbot_linked_wallets SET name=? WHERE sender=? AND address=?", name, senderId, wallet);
    return this.list(senderId);
  }

  /** Remove the link and every chat thread's choice of this wallet. Plans already signed stay on Base. */
  unlink(senderId: string, address: string): LinkedWallet[] {
    const wallet = this.require(senderId, address);
    this.sql.exec("DELETE FROM basedbot_chat_signers WHERE sender=? AND address=?", senderId, wallet);
    this.sql.exec("DELETE FROM basedbot_linked_wallets WHERE sender=? AND address=?", senderId, wallet);
    return this.list(senderId);
  }

  /** The linked wallet a chat thread signs with, or undefined for the Pecu wallet. */
  signer(senderId: string, conversationId: string): Address | undefined {
    const row = this.rows<{ address: string }>(
      "SELECT s.address FROM basedbot_chat_signers s JOIN basedbot_linked_wallets w ON w.sender=s.sender AND w.address=s.address WHERE s.sender=? AND s.conversation=?",
      senderId, conversationId,
    )[0];
    return row ? checksum(row.address) : undefined;
  }

  use(senderId: string, conversationId: string, address: string | null): void {
    if (address === null) {
      this.sql.exec("DELETE FROM basedbot_chat_signers WHERE sender=? AND conversation=?", senderId, conversationId);
      return;
    }
    const wallet = this.require(senderId, address);
    this.sql.exec("INSERT INTO basedbot_chat_signers(sender,conversation,address) VALUES(?,?,?) ON CONFLICT(sender,conversation) DO UPDATE SET address=excluded.address", senderId, conversationId, wallet);
  }

  private require(senderId: string, address: string): Address {
    const wallet = checksum(address);
    if (!this.isLinked(senderId, wallet)) throw new LinkedWalletError("This wallet isn't linked to your account.");
    return wallet;
  }
}
