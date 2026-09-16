import { createFileRoute } from "@tanstack/react-router";
import { useClerk, useUser, UserButton } from "@clerk/tanstack-react-start";
import { useEffect, useState } from "react";
import { Search, RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  marketSchema,
  stocksSchema,
  usdc,
  quantity,
  type Stock,
} from "../lib/market";
import { useAccount } from "../lib/use-account";
import { TradePanel } from "../components/trade-panel";
import { catalog } from "../lib/catalog";
import { Chat } from "../components/chat";
export const Route = createFileRoute("/aero/stocks")({
  head: () => ({ links: [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }] }),
  component: Stocks,
});
function Stocks() {
  const { user } = useUser();
  return <StockWorkspace key={user?.id ?? "signed-out"} />;
}
function StockWorkspace() {
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const account = useAccount(Boolean(isSignedIn));
  const [market, setMarket] = useState<Stock[]>(() =>
    catalog.map((s) => ({
      ...s,
      price_usdc: null,
      balance: null,
      error: null,
    })),
  );
  const [observedAt, setObservedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("NVDAc");
  const [view, setView] = useState("market");
  const signIn = () => {
    void clerk.openSignIn({ fallbackRedirectUrl: "/aero/stocks" });
  };
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/aero/stocks/api/market");
      if (!response.ok) throw new Error("Prices are temporarily unavailable.");
      const data = marketSchema.parse(await response.json());
      setMarket(data.stocks);
      setObservedAt(data.observedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stocks.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  let holdings: Stock[] = [];
  if (account.state?.stocks) {
    try {
      holdings = stocksSchema.parse(JSON.parse(account.state.stocks));
    } catch {}
  }
  const stocks = market.map((s) => ({
    ...s,
    balance: holdings.find((h) => h.symbol === s.symbol)?.balance ?? null,
  }));
  const stock = stocks.find((s) => s.symbol === selected) ?? stocks[0];
  const filtered = stocks.filter(
    (s) =>
      `${s.name} ${s.symbol}`.toLowerCase().includes(search.toLowerCase()) &&
      (view === "market" || Number(s.balance) > 0),
  );
  const total = holdings.reduce(
    (sum, s) => sum + Number(s.balance ?? 0) * Number(s.price_usdc ?? 0),
    0,
  );
  const partial = holdings.some(
    (s) => s.balance === null || s.price_usdc === null,
  );
  return (
    <div className="shell">
      <header className="topbar">
        <a className="wordmark" href="https://pecu.app/aero/cli">
          aero
        </a>
        <nav className="nav" aria-label="Main navigation">
          <a href="/aero/stocks" aria-current="page">
            Stocks
          </a>
          <a href="https://pecu.app/aero/cli">CLI</a>
          <a
            className="docs"
            href="https://pecu.app/aero/cli/docs"
          >
            Docs
            <ArrowUpRight size={13} className="inline ml-1" />
          </a>
        </nav>
        <div className="auth">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <Button variant="outline" onClick={signIn}>
              Sign in with X
            </Button>
          )}
        </div>
      </header>
      <div className="page-title">
        <h1>Stocks</h1>
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => {
            void refresh();
            if (isSignedIn) void account.send("/aero stocks");
          }}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
      {account.state?.wallet ? (
        <div className="wallet">
          <a
            href={`https://basescan.org/address/${account.state.wallet}`}
            target="_blank"
            rel="noreferrer"
            className="mono"
          >
            {account.state.wallet.slice(0, 6)}…{account.state.wallet.slice(-4)}
          </a>
          <span className="muted">Pecu wallet · Base</span>
        </div>
      ) : null}
      <div className="workspace">
        <div className="market">
          <div className="market-controls">
            <Tabs
              value={view}
              onValueChange={(v) => {
                setView(v);
                if (v === "holdings" && isSignedIn && !account.state?.stocks)
                  void account.send("/aero stocks");
              }}
            >
              <TabsList className="h-[42px]">
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="holdings">Holdings</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="search">
              <Search size={17} />
              <Input
                aria-label="Search stocks"
                placeholder="Search stocks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <div className="error" role="alert">
              {error}
              <Button variant="link" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : null}
          {view === "holdings" && !isSignedIn ? (
            <div className="p-6 bg-white rounded-xl">
              <p className="mb-4">
                Sign in with your Pecu X account to see your holdings.
              </p>
              <Button onClick={signIn}>Sign in with X</Button>
            </div>
          ) : (
            <>
              {view === "holdings" && holdings.length ? (
                <div className="portfolio-total">
                  <span>{partial ? "Priced holdings" : "Stock holdings"}</span>
                  {usdc(total)}
                  <p className="muted">
                    {partial ? "Some holdings could not be priced. " : ""}
                    {account.state?.stocksAt
                      ? `Checked ${new Date(account.state.stocksAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                </div>
              ) : null}
              <table className="stock-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Price · USDC</th>
                    <th scope="col" className="holding-col">
                      You hold
                    </th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.symbol}
                      className={s.symbol === selected ? "selected" : ""}
                    >
                      <td>
                        <button
                          className="stock-cell"
                          onClick={() => {
                            setSelected(s.symbol);
                            document.getElementById("trade")?.scrollIntoView({
                              block: "nearest",
                              behavior: "smooth",
                            });
                          }}
                          aria-label={`Select ${s.name}`}
                          aria-pressed={s.symbol === selected}
                        >
                          <span className="stock-avatar">
                            {s.name.slice(0, 1)}
                          </span>
                          <span>
                            <strong>{s.name}</strong>
                            <small>{s.symbol}</small>
                          </span>
                        </button>
                      </td>
                      <td className="mono">
                        {s.price_usdc === null ? (
                          <span className="muted">
                            {loading && !observedAt
                              ? "Loading…"
                              : "Unavailable"}
                          </span>
                        ) : (
                          usdc(s.price_usdc)
                        )}
                      </td>
                      <td className="mono holding-col">
                        {s.balance === null ? (
                          <span className="muted">—</span>
                        ) : (
                          quantity(s.balance)
                        )}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Trade ${s.symbol}`}
                          onClick={() => {
                            setSelected(s.symbol);
                            document.getElementById("trade")?.scrollIntoView({
                              block: "nearest",
                              behavior: "smooth",
                            });
                          }}
                        >
                          <ArrowUpRight size={17} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && !market.length ? (
                <div aria-label="Loading stocks">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              ) : null}
              {!loading && !filtered.length && !error ? (
                <p className="muted p-6">
                  {view === "holdings"
                    ? "No stock holdings to show. Refresh to check your wallet."
                    : "No stocks match your search."}
                </p>
              ) : null}
              {observedAt ? (
                <div className="market-meta">
                  <span>Tokenized stocks on Base</span>
                  <span>
                    Quoted{" "}
                    {new Date(observedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ) : null}
            </>
          )}
          <Chat
            account={account}
            signedIn={Boolean(isSignedIn)}
            signIn={signIn}
          />
        </div>
        {stock ? (
          <TradePanel
            stock={stock}
            stocks={stocks}
            signedIn={Boolean(isSignedIn)}
            busy={account.pending}
            state={account.state}
            signIn={signIn}
            send={account.send}
            reload={account.reload}
          />
        ) : null}
      </div>
      <p className="notice">
        Prices are token swap quotes for one token, not exchange share prices.
        Aero is experimental and unofficial.{" "}
        <a className="link" href="https://pecu.app/aero/cli#experimental">
          Read the risks.
        </a>
      </p>
    </div>
  );
}
