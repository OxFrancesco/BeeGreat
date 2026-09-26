import { linkedWalletActionSchema, type LinkedStep, type LinkedWallet } from "../../../../src/linked-wallet-contract";
import type { WebState } from "../../../../src/web-contract";
import { planAt, transactionPlans } from "../fixtures/transaction-plans";

/**
 * Fictional linked wallets for UI checks. `?linked` prelinks Rabby (connected)
 * and a second wallet; `?linked=none` starts with no links. The simulated
 * Rabby provider signs link messages and sends transactions without a network.
 */
const rabby = "0x5151515151515151515151515151515151515151";
const ledger = "0x7A7a7a7A7a7a7a7A7a7a7a7A7A7a7A7a7a7A7a7a";
const pecuWallet = "0x1234567890123456789012345678901234567890";
const params = new URLSearchParams(location.search);
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export const linkedMode = params.has("linked");
let wallets: LinkedWallet[] = [];
let pendingLink: string | null = null;

function installProvider(rabby: string) {
  const icon = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7084ff"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>')}`;
  let accounts: string[] = params.has("disconnected") ? [] : [rabby];
  if (accounts.length) localStorage.setItem("pecu-browser-wallet", JSON.stringify({ rdns: "io.rabby", address: rabby }));
  else localStorage.removeItem("pecu-browser-wallet");
  const provider = {
    request: async ({ method }: { method: string }) => {
      await wait(250);
      if (method === "eth_accounts") return accounts;
      if (method === "eth_requestAccounts") return (accounts = [rabby]);
      if (method === "eth_chainId") return "0x2105";
      if (method === "personal_sign") return `0x${"33".repeat(64)}1b`;
      if (method === "eth_signTypedData_v4") return `0x${"22".repeat(64)}1c`;
      if (method === "eth_sendTransaction") return `0x${"cd".repeat(32)}`;
      throw Object.assign(new Error(`Unsupported ${method}`), { code: 4200 });
    },
    on: () => {},
    removeListener: () => {},
  };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "rabby-fixture", name: "Rabby", icon, rdns: "io.rabby" }, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
}

type Preview = NonNullable<NonNullable<WebState["messages"][number]["reply"]>["preview"]>;
const swapText = `Swap 0.01 ETH for about 38.9 USDC on Base.\nMinimum received: 38.5 USDC\nNetwork fee: not estimated yet.\nWallet: ${rabby}\nYour wallet pays the Base network fee.`;
const preview: Preview = { code: "K7PX2M", title: "Swap", state: "pending", expiresAt: Date.now() + 600_000, text: swapText, plan: transactionPlans.swap, signer: rabby };
let sent = 0;

function chatState(): WebState {
  const thread = { id: null, title: "Swap from Rabby", createdAt: 1, updatedAt: Date.now(), count: 2 };
  return {
    threadId: null,
    thread,
    threads: [thread],
    wallet: pecuWallet,
    senderKind: "web",
    yolo: false,
    signer: wallets.some((wallet) => wallet.address === signer) ? signer : null,
    olderCursor: null,
    newerCursor: null,
    messages: [
      { id: "lw:1", text: "What's my balance?", createdAt: 1, reply: { text: "ETH: 0.08\nUSDC: 41.2\nAERO: 0", preview: null } },
      { id: "lw:2", text: "Swap 0.01 ETH to USDC", createdAt: 2, reply: { text: swapText, preview } },
    ],
    stocks: null,
    stocksAt: null,
    basket: null,
  };
}
let signer: string | null = rabby;

function step(action: { op: "step" | "submitted" | "declined"; resend?: boolean }): LinkedStep {
  if (action.op === "declined") {
    preview.state = "pending";
    return { kind: "status", state: "pending", message: "You declined in your wallet. Nothing was sent." };
  }
  if (action.op === "submitted") return { kind: "waiting", position: 0, hash: `0x${"cd".repeat(32)}` };
  if (preview.state === "pending") {
    preview.state = "executing";
    preview.plan = planAt(transactionPlans.swap, "executing");
    return { kind: "send", position: 0, total: 1, chainId: 8453, transaction: { from: rabby, to: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43", data: "0x12345678", value: "10000000000000000" } };
  }
  sent += 1;
  if (sent < 2) return { kind: "waiting", position: 0, hash: `0x${"cd".repeat(32)}` };
  preview.state = "succeeded";
  preview.plan = planAt(transactionPlans.swap, "succeeded");
  preview.result = `Swap confirmed on Base mainnet from your wallet.\nhttps://basescan.org/tx/0x${"cd".repeat(32)}`;
  return { kind: "status", state: "succeeded", message: preview.result };
}

/** Handle linked-wallet requests, falling back to the page's own fixture for everything else. */
export function linkedWalletFixture({ chat = false, primary = rabby }: Readonly<{ chat?: boolean; primary?: string }> = {}) {
  if (!linkedMode) return;
  wallets = params.get("linked") === "none" ? [] : [
    { address: primary, name: "Rabby", linkedAt: 1 },
    { address: ledger, name: null, linkedAt: 2 },
  ];
  installProvider(primary);
  const inner = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(String(input), location.origin);
    if (url.pathname.endsWith("/wallets")) return Response.json({ wallets });
    if (url.pathname.endsWith("/wallet") && init?.method === "POST") {
      const action = linkedWalletActionSchema.parse(JSON.parse(String(init.body)));
      await wait();
      switch (action.op) {
        case "challenge":
          pendingLink = action.address;
          return Response.json({ kind: "challenge", challenge: "a".repeat(32), expiresAt: Date.now() + 300_000, message: `${location.host} wants you to sign in with your Ethereum account:\n${action.address}\n\nLink this wallet to your Pecu account. Signing is free and does not send a transaction.` });
        case "link":
          wallets = [...wallets.filter((wallet) => wallet.address !== pendingLink), { address: pendingLink ?? rabby, name: null, linkedAt: Date.now() }];
          return Response.json({ kind: "wallets", wallets });
        case "rename":
          wallets = wallets.map((wallet) => (wallet.address === action.address ? { ...wallet, name: action.name } : wallet));
          return Response.json({ kind: "wallets", wallets });
        case "unlink":
          wallets = wallets.filter((wallet) => wallet.address !== action.address);
          return Response.json({ kind: "wallets", wallets });
        case "use":
          signer = action.address;
          return Response.json({ kind: "wallets", wallets });
        default:
          return Response.json({ kind: "step", step: step(action) });
      }
    }
    if (chat && (url.pathname.endsWith("/state") || url.pathname.endsWith("/messages"))) return Response.json(chatState());
    if (chat && url.pathname.endsWith("/threads")) return Response.json({ threads: chatState().threads, olderCursor: null, newerCursor: null });
    return inner(input, init);
  };
}
