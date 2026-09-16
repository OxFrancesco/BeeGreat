import { useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { Stock } from "../lib/market";
import { usdc } from "../lib/market";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { request } from "../lib/use-account";
import type { WebState } from "../../../../src/web-contract";

type Props = {
  stock: Stock;
  stocks: Stock[];
  signedIn: boolean;
  busy: boolean;
  state: WebState | null;
  signIn: () => void;
  send: (text: string) => Promise<void>;
  reload: () => Promise<void>;
};
export function TradePanel({
  stock,
  stocks,
  signedIn,
  busy,
  state,
  signIn,
  send,
  reload,
}: Props) {
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [name, setName] = useState("My basket");
  const [cash, setCash] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const allocations = stocks
    .filter((s) => Number(weights[s.symbol]) > 0)
    .map((s) => `${s.symbol}=${weights[s.symbol]}`)
    .join(",");
  const total = Object.values(weights).reduce(
    (sum, w) => sum + Math.round(Number(w || 0) * 100),
    0,
  );
  const validAmount = /^\d+(\.\d+)?$/.test(amount) && Number(amount) > 0;
  async function save() {
    setError("");
    setSaving(true);
    try {
      await request("basket", { name, allocations });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save basket");
    } finally {
      setSaving(false);
    }
  }
  return (
    <aside
      id="trade"
      className="trade-panel"
    >
      <div className="trade-heading">
        <div className="stock-avatar">{stock.name.slice(0, 1)}</div>
        <div>
          <h2>{stock.name}</h2>
          <p>{stock.symbol}</p>
        </div>
      </div>
      <Tabs value={side} onValueChange={setSide}>
        <TabsList className="w-full h-10">
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
          <TabsTrigger value="basket">Basket</TabsTrigger>
        </TabsList>
        {["buy", "sell"].map((action) => (
          <TabsContent key={action} value={action}>
            <label htmlFor={`${action}-amount`}>
              {action === "buy" ? "You spend" : "You sell"}
            </label>
            <div className="amount-field">
              <Input
                id={`${action}-amount`}
                value={amount}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => setAmount(e.target.value)}
              />
              <span>{action === "buy" ? "USDC" : stock.symbol}</span>
            </div>
            <div className="trade-note muted">
              {stock.price_usdc ? (
                <p>
                  1 {stock.symbol} ≈ {usdc(stock.price_usdc)} USDC
                </p>
              ) : (
                <p>Price unavailable. The agent will check for a route.</p>
              )}
              <p>
                Your preview includes the minimum received and any approvals.
                Review it before confirming.
              </p>
            </div>
            <Button
              className="trade-submit"
              disabled={busy || (signedIn && !validAmount)}
              onClick={() =>
                signedIn
                  ? void send(
                      `/aero stock-${action} --stock ${stock.symbol} --amount ${amount}`,
                    )
                  : signIn()
              }
            >
              {signedIn ? "Preview " + action : "Sign in"}
              <ArrowRight size={16} />
            </Button>
          </TabsContent>
        ))}
        <TabsContent value="basket">
          {state?.basket ? (
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => {
                setName(state.basket!.name);
                setWeights(
                  Object.fromEntries(
                    state
                      .basket!.allocations.split(",")
                      .map((p) => p.split("=")),
                  ),
                );
              }}
            >
              Load {state.basket.name}
            </Button>
          ) : null}
          <label htmlFor="basket-name">Basket name</label>
          <Input
            id="basket-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <div className="my-4">
            {stocks.map((s) => (
              <div className="basket-row" key={s.symbol}>
                <label htmlFor={`weight-${s.symbol}`}>{s.symbol}</label>
                <Input
                  id={`weight-${s.symbol}`}
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  placeholder="0"
                  value={weights[s.symbol] ?? ""}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [s.symbol]: e.target.value }))
                  }
                />
                <span>%</span>
              </div>
            ))}
          </div>
          <p className={total === 10000 ? "muted" : "error"}>
            Allocated {(total / 100).toFixed(2)}% of 100%
          </p>
          <label htmlFor="cash">Add USDC</label>
          <Input
            id="cash"
            inputMode="decimal"
            value={cash}
            placeholder="0"
            onChange={(e) => setCash(e.target.value)}
          />
          <div className="grid gap-2 mt-5">
            <Button
              disabled={busy || saving || total !== 10000}
              onClick={() =>
                signedIn
                  ? void send(
                      `/aero index-rebalance --allocations ${allocations} --cash ${cash || "0"}`,
                    )
                  : signIn()
              }
            >
              Preview rebalance
            </Button>
            <Button
              variant="outline"
              disabled={busy || saving || total !== 10000 || !name.trim()}
              onClick={() => (signedIn ? void save() : signIn())}
            >
              {saving ? "Saving…" : "Save basket"}
            </Button>
          </div>
          {error ? (
            <p className="error mt-3" role="alert">
              {error}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
      <a
        className="contract"
        href={`https://basescan.org/token/${stock.address}`}
        target="_blank"
        rel="noreferrer"
      >
        View token on Base
        <ArrowUpRight size={15} />
      </a>
    </aside>
  );
}
