import { ArrowRight, QrCode, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, formatAmount, frames, mix, rise, settle, tween } from "./motion";
import { bento } from "./timeline";

/** Six tiles in a 3×2 bento, sized like the homepage tool tiles. */
const GRID = { x: 60, y: 128, width: 840, height: 372, gap: 14 };
const TILE_W = (GRID.width - GRID.gap * 2) / 3;
const TILE_H = (GRID.height - GRID.gap) / 2;
/** The dark Safe tile grows into the closing frame. */
const EXPANDING = 4;

type TileProps = { at: number };

function Aave({ at }: TileProps) {
  const frame = useCurrentFrame();
  const rows = [
    { label: "Supply", value: 500, digits: 0, unit: "USDC" },
    { label: "Borrow", value: 0.05, digits: 2, unit: "ETH" },
  ];
  return (
    <div className="recessed" style={{ display: "grid", gap: 6, padding: "10px 14px" }}>
      {rows.map((row, i) => (
        <div className="row" key={row.label} style={{ ...rise(tween(frame, at + i * 0.1, 0.45), 6), fontSize: 13 }}>
          <span className="muted">{row.label}</span>
          <strong className="mono" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>
            {formatAmount(row.value * tween(frame, at + i * 0.1, 0.7), row.digits)} {row.unit}
          </strong>
        </div>
      ))}
    </div>
  );
}

function Earn({ at }: TileProps) {
  const frame = useCurrentFrame();
  const steps = ["Deposit", "Stake", "Claim fees"];
  return (
    <>
      <span className="pill" style={{ alignSelf: "flex-start", ...rise(tween(frame, at, 0.4), 6) }}>
        USDC / AERO
        <span style={{ fontWeight: 500, color: "var(--muted-foreground)" }}>Volatile</span>
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {steps.map((step, i) => {
          const pop = settle(frame, at + 0.2 + i * 0.14);
          return (
            <span
              className="pill"
              key={step}
              style={{
                opacity: Math.min(1, pop * 2),
                transform: `scale(${mix(0.9, 1, pop)})`,
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                boxShadow: "var(--clay-shadow-primary)",
              }}
            >
              {step}
            </span>
          );
        })}
      </div>
    </>
  );
}

function Lock({ at }: TileProps) {
  const frame = useCurrentFrame();
  const fill = tween(frame, at + 0.2, 0.7, easeInOut);
  return (
    <>
      <strong className="mono" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.05em", ...rise(tween(frame, at, 0.45), 6) }}>
        {formatAmount(1000 * tween(frame, at, 0.8), 0)} AERO
      </strong>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {[0, 1, 2, 3].map((year) => (
          <span key={year} className="recessed" style={{ height: 12, borderRadius: 6, overflow: "hidden" }}>
            {year === 0 ? (
              <span
                style={{ display: "block", height: "100%", background: "var(--primary)", transformOrigin: "0 50%", transform: `scaleX(${fill})` }}
              />
            ) : null}
          </span>
        ))}
      </div>
      <span className="card-meta">Locked for 1 year</span>
    </>
  );
}

function Deposit({ at }: TileProps) {
  const frame = useCurrentFrame();
  const move = tween(frame, at + 0.25, 0.5);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <strong className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.05em", ...rise(tween(frame, at, 0.4), 6) }}>
          $50.00
        </strong>
        <ArrowRight size={16} className="muted" style={{ opacity: move, transform: `translateX(${(1 - move) * -6}px)` }} />
        <strong className="mono" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.05em", ...rise(move, 6) }}>
          50 USDC
        </strong>
      </div>
      <span className="card-meta">By bank transfer or crypto</span>
    </>
  );
}

function Safe({ at }: TileProps) {
  const frame = useCurrentFrame();
  const owners = ["You", "AL", "JS"];
  const approved = [tween(frame, at + 0.3, 0.16), tween(frame, at + 0.75, 0.16)];
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        {owners.map((owner, i) => {
          const on = approved[i] ?? 0;
          return (
            <span
              className="bead"
              key={owner}
              style={{
                ...rise(tween(frame, at + i * 0.08, 0.4), 6),
                background: on > 0.5 ? "var(--primary)" : "var(--dark-card)",
                color: on > 0.5 ? "var(--primary-foreground)" : "var(--dark-foreground)",
                boxShadow: on > 0.5 ? "var(--clay-shadow-primary)" : "inset 1px 2px 5px var(--dark)",
                border: "1px solid var(--dark-border)",
              }}
            >
              {owner}
            </span>
          );
        })}
      </div>
      <span style={{ fontSize: 13, color: "var(--dark-muted-foreground)" }}>
        <b className="mono" style={{ color: "var(--dark-foreground)" }}>
          {approved.filter((value) => value > 0.5).length} of 3
        </b>{" "}
        owners approved
      </span>
    </>
  );
}

function Linked({ at }: TileProps) {
  const frame = useCurrentFrame();
  return (
    <>
      <span className="pill" style={{ alignSelf: "flex-start", ...rise(tween(frame, at, 0.4), 6) }}>
        <Wallet size={14} />
        <span className="mono">0x51c2…a9e0</span>
        <span style={{ fontWeight: 500, color: "var(--accent-foreground)" }}>Linked</span>
      </span>
      <span className="pill" style={{ alignSelf: "flex-start", ...rise(tween(frame, at + 0.12, 0.4), 6) }}>
        <QrCode size={14} />
        WalletConnect
      </span>
    </>
  );
}

const tiles: { title: string; tone: "card" | "accent" | "muted" | "dark"; visual: (props: TileProps) => ReactNode }[] = [
  { title: "Lend on Aave", tone: "card", visual: Aave },
  { title: "Earn on Aerodrome", tone: "accent", visual: Earn },
  { title: "Lock AERO", tone: "muted", visual: Lock },
  { title: "Deposit from your bank", tone: "card", visual: Deposit },
  { title: "Share a Safe", tone: "dark", visual: Safe },
  { title: "Sign with your own wallet", tone: "card", visual: Linked },
];

/** Tiles rise in with the homepage stagger; the Safe tile then opens into the closing frame. */
export function Bento() {
  const frame = useCurrentFrame();
  if (frame < frames(bento.in)) return null;
  const expand = tween(frame, bento.expand, 0.65, easeInOut);
  const clear = tween(frame, bento.expand, 0.3, easeInOut);
  return (
    <div className="layer">
      {tiles.map((tile, i) => {
        const column = i % 3;
        const row = Math.floor(i / 3);
        const x = GRID.x + column * (TILE_W + GRID.gap);
        const y = GRID.y + row * (TILE_H + GRID.gap);
        const arrive = tween(frame, bento.in + i * bento.stagger, 0.48, easeOut);
        const grows = i === EXPANDING;
        const Visual = tile.visual;
        return (
          <div
            className={`tile${tile.tone === "card" ? "" : ` is-${tile.tone}`}`}
            key={tile.title}
            style={{
              left: grows ? mix(x, 0, expand) : x,
              top: grows ? mix(y, 0, expand) : y,
              width: grows ? mix(TILE_W, 960, expand) : TILE_W,
              height: grows ? mix(TILE_H, 540, expand) : TILE_H,
              borderRadius: grows ? mix(22, 0, expand) : undefined,
              borderColor: grows && expand > 0.9 ? "transparent" : undefined,
              zIndex: grows ? 1 : 0,
              opacity: Math.min(1, arrive * 1.5) * (grows ? 1 : 1 - clear),
              transform: `translateY(${(1 - arrive) * 22 + (grows ? 0 : clear * 10)}px) scale(${mix(0.98, 1, arrive)})`,
            }}
          >
            <h3 style={{ opacity: grows ? 1 - clear : 1 }}>{tile.title}</h3>
            <div className="tile-visual" style={{ opacity: grows ? 1 - clear : 1 }}>
              <Visual at={bento.in + i * bento.stagger + 0.35} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
