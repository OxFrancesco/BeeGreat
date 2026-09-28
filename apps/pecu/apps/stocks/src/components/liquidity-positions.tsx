import { useState } from "react";
import { compactPositionAmount, legacyPositions, type LiquidityPosition } from "../../../../src/position-contract";
import { Button } from "./ui/button";

export { legacyPositions };

function total(a: string, b: string): string {
  const places = Math.max(a.split(".")[1]?.length ?? 0, b.split(".")[1]?.length ?? 0);
  const units = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(`${whole}${fraction.padEnd(places, "0")}`); };
  const value = (units(a) + units(b)).toString().padStart(places + 1, "0");
  return places ? `${value.slice(0, -places)}.${value.slice(-places)}` : value;
}

function PositionCard({ position }: { position: LiquidityPosition }) {
  const tokens = [position.token0, position.token1];
  const staked = tokens.some((token) => /[1-9]/.test(token.staked));
  const unstaked = tokens.some((token) => /[1-9]/.test(token.unstaked));
  return <article className="pecu-position-card bg-muted p-5">
    <h3 className="font-semibold">{position.token0.symbol} / {position.token1.symbol}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{position.chain} · {staked && unstaked ? "Partly staked" : staked ? "Staked" : unstaked ? "Unstaked" : "Empty"}</p>
    <div className="my-3 space-y-1">{tokens.map((token, index) => {
      const value = total(token.unstaked, token.staked);
      return /[1-9]/.test(value) ? <p key={index} className="text-xl font-semibold tabular-nums break-words">{compactPositionAmount(value)} {token.symbol}</p> : null;
    })}</div>
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">Details</summary>
      <div className="space-y-2 break-words">
        <p>{position.label}</p><p>Position {position.id}</p>
        {tokens.map((token, index) => <p key={index}>{token.unstaked} {token.symbol} unstaked<br />{token.staked} {token.symbol} staked</p>)}
        <p className="break-all font-mono">{position.pool}</p>
      </div>
    </details>
  </article>;
}

export function LiquidityPositions({ positions }: { positions: LiquidityPosition[] }) {
  const [limit, setLimit] = useState(3);
  return <div className="my-3 grid min-w-0 gap-3">
    {positions.slice(0, limit).map((position) => <PositionCard key={`${position.pool}:${position.id}`} position={position} />)}
    {positions.length > limit ? <Button variant="ghost" onClick={() => setLimit(limit + 3)}>Show more positions</Button> : null}
    {limit > 3 ? <Button variant="ghost" onClick={() => setLimit(3)}>Show fewer positions</Button> : null}
  </div>;
}
