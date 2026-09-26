import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TransferForm } from "../../src/components/wallet-transfer";
import { WalletPortfolio } from "../../src/components/wallet-portfolio";
import "./fixture.css";

const pecu = "0x1111111111111111111111111111111111111111";
const linked = "0x2222222222222222222222222222222222222222";
const original = window.fetch.bind(window);
const calls: unknown[] = [];
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.href);
  if (!url.pathname.startsWith("/stocks/api/")) return original(input, init);
  if (init?.method === "POST") {
    calls.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
    document.querySelector("output")!.textContent = JSON.stringify(calls);
    return Response.json(url.pathname.endsWith("/wallet") ? { kind: "wallets", wallets: [] } : { status: "complete" });
  }
  return Response.json({ wallet: url.searchParams.get("wallet"), balances: url.searchParams.getAll("token").map((reference) => ({ reference, symbol: reference.toUpperCase(), address: reference === "eth" ? null : `0x${"33".repeat(20)}`, amount: reference === "eth" ? "0.00419881134121144" : "5.907128", error: null })), holdings: null, stocksError: null });
};
function Fixture() {
  const [open, setOpen] = useState(true);
  return <main className="pecu transaction-fixture"><h1>Transfer form fixture</h1><p>Fictional balances. Requests stay in this page.</p><button onClick={() => setOpen(true)}>Send tokens</button><WalletPortfolio address={pecu} compact />{open && <TransferForm pecuWallet={pecu} initialWallet={pecu} wallets={[{ address: linked, name: "Rabby", linkedAt: 1 }]} onClose={() => setOpen(false)} onReviewed={() => setOpen(false)} />}<output /></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
