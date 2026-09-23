import type { ProfileIntent, ProfileOverview, ProfileProposal, ProfileSafeDetail } from "../../../../src/safe-profile-contract";

export const pecuWallet = "0x1234567890AbcdEF1234567890aBcdef12345678";
export const alice = "0xA11CE00000000000000000000000000000000A11";
export const bob = "0xB0B0000000000000000000000000000000000B0B";
export const treasury = "0x5afE5aFE5AFE5afe5AfE5aFe5AFE5aFe5aFe5AFE";
export const ops = "0x0b5000000000000000000000000000000000B500";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const aero = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
const hash = (seed: string) => `0x${seed.repeat(64).slice(0, 64)}`;

export const profileOverview: ProfileOverview = {
  wallet: pecuWallet,
  senderKind: "web",
  balances: [
    { symbol: "ETH", token: null, decimals: 18, amount: "0.042" },
    { symbol: "USDC", token: usdc, decimals: 6, amount: "86.5" },
    { symbol: "AERO", token: aero, decimals: 18, amount: "0" },
  ],
  orgs: [
    {
      id: "a1b2c3d4e5f60718",
      name: "Bee Labs",
      createdAt: Date.UTC(2026, 8, 20),
      safes: [
        { address: treasury, name: "Treasury", status: "ready" },
        { address: ops, name: "Operations", status: "creating" },
      ],
      contacts: [
        { address: alice, name: "Alice" },
        { address: bob, name: "Bob" },
      ],
    },
  ],
};

const transaction = (seed: string, to: `0x${string}`, data = "0x"): ProfileProposal["transaction"] => ({ chainId: 8453, safe: treasury, to, value: "0", data, nonce: "7", hash: hash(seed) });

export const pendingSend: ProfileProposal = {
  hash: hash("a"),
  nonce: "7",
  title: "Send 2500 USDC",
  summary: `Send 2500 USDC to ${alice}`,
  kind: "send",
  createdAt: Date.UTC(2026, 8, 22, 14, 5),
  proposer: "owner",
  transaction: transaction("a", usdc, "0xa9059cbb000000000000000000000000a11ce00000000000000000000000000000000a1100000000000000000000000000000000000000000000000000000000950c7900"),
  approvals: [{ owner: alice, via: "signature" }],
  signatures: [{ owner: alice, data: `0x${"11".repeat(64)}1b` }],
  state: "queued",
  executedTransaction: null,
  intents: [],
};

export const pendingOwner: ProfileProposal = {
  hash: hash("b"),
  nonce: "7",
  title: "Add owner",
  summary: "Add owner 0xC4A7000000000000000000000000000000000C4A and require 2 approvals",
  kind: "owner-add",
  createdAt: Date.UTC(2026, 8, 23, 9, 30),
  proposer: "you",
  transaction: transaction("b", treasury, "0x0d582f13"),
  approvals: [],
  signatures: [],
  state: "queued",
  executedTransaction: null,
  intents: [],
};

export const treasuryDetail: ProfileSafeDetail = {
  address: treasury,
  name: "Treasury",
  org: { id: "a1b2c3d4e5f60718", name: "Bee Labs" },
  status: "ready",
  creation: null,
  wallet: pecuWallet,
  owners: [pecuWallet, alice, bob],
  threshold: 2,
  nonce: "7",
  modules: [{ address: "0xAA46724893dedD72658219405185Fb0Fc91e091C", name: "Spending limits" }],
  balances: [
    { symbol: "ETH", token: null, decimals: 18, amount: "1.25" },
    { symbol: "USDC", token: usdc, decimals: 6, amount: "12500" },
    { symbol: "AERO", token: aero, decimals: 18, amount: "340.5" },
  ],
  queue: [pendingSend, pendingOwner],
  history: [
    { ...pendingSend, hash: hash("c"), nonce: "6", title: "Send 0.5 ETH", summary: `Send 0.5 ETH to ${bob}`, createdAt: Date.UTC(2026, 8, 18, 10, 0), approvals: [], signatures: [], state: "executed", executedTransaction: hash("d") },
    { ...pendingSend, hash: hash("e"), nonce: "5", title: "Reject pending transactions", kind: "reject", summary: "Cancel other transactions at the current wallet nonce", createdAt: Date.UTC(2026, 8, 15, 16, 20), approvals: [], signatures: [], state: "replaced", executedTransaction: null },
  ],
  budgets: [{ delegate: pecuWallet, token: usdc, symbol: "USDC", decimals: 6, amount: "500", spent: "120", remaining: "380", resetMinutes: 1440 }],
  intents: [],
  contacts: [
    { address: alice, name: "Alice" },
    { address: bob, name: "Bob" },
  ],
  observedAt: Date.UTC(2026, 8, 23, 10, 0),
};

export const opsDetail: ProfileSafeDetail = {
  ...treasuryDetail,
  address: ops,
  name: "Operations",
  status: "creating",
  owners: [pecuWallet, alice],
  threshold: 1,
  nonce: "0",
  modules: [],
  balances: [],
  queue: [],
  history: [],
  budgets: [],
  creation: fixtureIntent("create", "Create Safe", `Create an organization wallet requiring 1 of 2 owners.\nWallet: ${ops}\nOwners: ${pecuWallet}, ${alice}\nOwners must control their own keys for independent approval.\nNetwork fee: not estimated yet.`),
};

export function fixtureIntent(kind: ProfileIntent["kind"], title: string, text: string): ProfileIntent {
  return { requestId: crypto.randomUUID(), kind, preview: { code: "K7PX2M", title, text, state: "pending", expiresAt: Date.now() + 10 * 60_000 } };
}
