import { PlusIcon, XIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { z } from "zod";
import { portfolioSchema, portfolioTokenSchema, type Portfolio } from "../../../../src/portfolio-contract";
import { request } from "../lib/use-account";
import { balanceAmount } from "../lib/balance-amount";
import { StockHoldings } from "./stock-holdings";
import { Button } from "./ui/button";

const defaults = ["eth", "usdc"];
const storageKey = (wallet: string) => `pecu:portfolio:${wallet.toLowerCase()}`;

export function WalletPortfolio({ address, compact = false }: { address: string; compact?: boolean }) {
  return <PortfolioContents key={`${address.toLowerCase()}:${compact}`} address={address} compact={compact} />;
}

function PortfolioContents({ address, compact }: { address: string; compact: boolean }) {
  const [tokens, setTokens] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [addError, setAddError] = useState("");
  const [data, setData] = useState<Portfolio | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = z.array(portfolioTokenSchema.catch("")).parse(JSON.parse(window.localStorage.getItem(storageKey(address)) ?? "[]"));
      setTokens([...new Set([...defaults, ...saved.filter(Boolean).map((item) => item.toLowerCase())])].slice(0, 20));
    } catch { /* Storage may be disabled. Balances still work. */ }
    setReady(true);
  }, [address]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    const query = new URLSearchParams([...tokens.map((token) => ["token", token]), ["wallet", address]]);
    request(`portfolio?${query}`, undefined, controller.signal).then((raw) => {
      const value = portfolioSchema.parse(raw);
      if (!controller.signal.aborted) { setData(value); setError(""); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load balances.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [address, ready, tokens, revision]);
  const save = (next: string[]) => {
    setTokens(next);
    try { window.localStorage.setItem(storageKey(address), JSON.stringify(next)); } catch { setError("Token list could not be saved on this device."); }
  };
  const add = async () => {
    const parsed = portfolioTokenSchema.safeParse(input);
    if (!parsed.success) { setAddError("Enter a token ticker or Base contract address."); return; }
    const reference = parsed.data.toLowerCase();
    if (tokens.includes(reference)) { setAddError("This token is already shown."); return; }
    if (tokens.length >= 20) { setAddError("Remove a token before adding another."); return; }
    setAdding(true);
    setAddError("");
    try {
      const result = portfolioSchema.parse(await request(`portfolio?${new URLSearchParams({ token: reference, wallet: address })}`));
      const balance = result.balances[0];
      if (!balance || balance.error) throw new Error(balance?.error ?? "Your wallet is not ready yet.");
      if (balance.address && data?.balances.some((row) => row.address?.toLowerCase() === balance.address?.toLowerCase())) throw new Error("This token is already shown.");
      save([...tokens, reference]);
      setInput("");
      setAddOpen(false);
    } catch (cause) { setAddError(cause instanceof Error ? cause.message : "Could not add token."); }
    finally { setAdding(false); }
  };
  return <>
    <section className="pecu-portfolio" aria-label="Token balances" aria-busy={loading}>
      <div className="pecu-portfolio-head"><h2>Balances</h2>{!compact && <div className="pecu-portfolio-actions">
        <Button variant="ghost" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</Button>
        <Popover.Root open={addOpen} onOpenChange={(open) => { setAddOpen(open); setAddError(""); }}>
          <Popover.Trigger asChild><Button variant="ghost" size="icon" aria-label="Add token"><PlusIcon className="size-4" /></Button></Popover.Trigger>
          <Popover.Portal><Popover.Content className="pecu pecu-portfolio-popover" align="end" sideOffset={8} collisionPadding={12} aria-label="Add token">
            <div className="pecu-portfolio-head"><h2>Add token</h2><Popover.Close asChild><Button variant="ghost" size="icon" aria-label="Close add token"><XIcon className="size-4" /></Button></Popover.Close></div>
      <form className="pecu-portfolio-add" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <label className="sr-only" htmlFor="portfolio-token">Token ticker or Base contract address</label>
        <input id="portfolio-token" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ticker or Base contract address" autoComplete="off" maxLength={64} disabled={adding} />
        <Button type="submit" disabled={adding || !input.trim()}>{adding ? "Adding…" : "Add token"}</Button>
      </form>

            {addError && <p role="alert">{addError}</p>}
          </Popover.Content></Popover.Portal>
        </Popover.Root>
      </div>}</div>
      <dl className="pecu-portfolio-balances">
        {tokens.map((reference) => {
          const row = data?.balances.find((balance) => balance.reference === reference);
          return <div key={reference}><dt>{row?.symbol ?? (reference.startsWith("0x") ? `${reference.slice(0, 6)}…${reference.slice(-4)}` : reference.toUpperCase())}</dt><dd>{row?.amount != null ? balanceAmount(row.amount) : (row?.error ? "Unavailable" : loading ? "Loading…" : "—")}</dd>{!compact && !defaults.includes(reference) && <Button variant="ghost" aria-label={`Remove ${row?.symbol ?? reference}`} disabled={adding} onClick={() => save(tokens.filter((token) => token !== reference))}>Remove</Button>}{row?.error && <p role="status">{row.error}</p>}</div>;
        })}
      </dl>
      {data?.wallet === null && <p>Your wallet is not ready yet.</p>}
      {error && !addOpen && <p role="alert">{error}</p>}
    </section>
    {!compact && <PortfolioStocks address={address} />}
  </>;
}

function PortfolioStocks({ address }: { address: string }) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    request(`portfolio?${new URLSearchParams({ stocks: "1", wallet: address })}`, undefined, controller.signal).then((raw) => {
      const value = portfolioSchema.parse(raw);
      if (!controller.signal.aborted) { setData(value); setError(value.stocksError ?? ""); }
    }).catch(() => { if (!controller.signal.aborted) setError("Could not load stock positions."); });
    return () => controller.abort();
  }, [address, revision]);
  return data?.holdings ? <StockHoldings {...data.holdings} embedded /> : error ? <div role="alert">{error}<Button variant="ghost" onClick={() => setRevision((value) => value + 1)}>Retry stocks</Button></div> : <p role="status">{data?.wallet === null ? "Your wallet is not ready yet." : "Loading stock positions…"}</p>;
}
