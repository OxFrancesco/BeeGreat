import { ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentFrame } from "remotion";
import { BalanceCard, BasketCard, FlowsCard, OddsCard, SwapCard } from "./cards";
import { easeInOut, frames, linear, mix, settle, tween } from "./motion";
import { AVATAR_OFFSET, handOff, type Placement, RevealSnail, SnailFrame } from "./Snail";
import { chatOut, composerIn, confirmSwap, type Turn, turns, typeLead } from "./timeline";

/** Viewport y of the thread's scroll origin, and the height visible above the composer. */
const TOP = 48;
const VIEW = 452 - TOP;
const BUBBLE = 40;
const REPLY_GAP = 20;
const TURN_GAP = 36;
/** Where a sent message starts its trip up into the thread. */
const COMPOSER_Y = 473;

type ThreadTurn = Turn & {
  key: string;
  height: number;
  /** Scroll so the message sits at the top, or so the reply's end sits above the composer. */
  follow: "message" | "end";
  render: (at: number, height: number) => ReactNode;
};

const thread: ThreadTurn[] = [
  { key: "balance", ...turns.balance, height: 206, follow: "message", render: (at, h) => <BalanceCard at={at} height={h} /> },
  { key: "swap", ...turns.swap, height: 330, follow: "message", render: (at, h) => <SwapCard at={at} confirm={confirmSwap} height={h} /> },
  { key: "stocks", ...turns.stocks, height: 236, follow: "message", render: (at, h) => <BasketCard at={at} height={h} /> },
  { key: "flows", ...turns.flows, height: 244, follow: "message", render: (at, h) => <FlowsCard at={at} height={h} /> },
  { key: "odds", ...turns.odds, height: 92, follow: "end", render: (at, h) => <OddsCard at={at} height={h} /> },
];

const layout = (() => {
  let y = 0;
  return thread.map((turn) => {
    const messageY = y;
    const replyY = y + BUBBLE + REPLY_GAP;
    y = replyY + turn.height + TURN_GAP;
    const end = replyY + turn.height;
    return { ...turn, messageY, replyY, scroll: turn.follow === "message" ? messageY : end - VIEW };
  });
})();

type Laid = (typeof layout)[number];

const avatarFor = (turn: Laid): Placement => ({ cx: AVATAR_OFFSET.cx, cy: turn.replyY + AVATAR_OFFSET.dy, w: AVATAR_OFFSET.w });

/** The first avatar in viewport coordinates, where the reveal snail comes to rest. */
export const firstAvatar: Placement = { ...avatarFor(layout[0]), cy: TOP + avatarFor(layout[0]).cy };

function scrollAt(frame: number) {
  return layout.reduce(
    (scroll, turn, i) => (i === 0 ? scroll : mix(scroll, turn.scroll, tween(frame, turn.send, 0.55, easeInOut))),
    0,
  );
}

function Message({ turn, scroll }: { turn: Laid; scroll: number }) {
  const frame = useCurrentFrame();
  if (frame < frames(turn.send)) return null;
  const travel = settle(frame, turn.send);
  const resting = TOP + turn.messageY - scroll;
  const offset = mix(COMPOSER_Y, resting, travel) - resting;
  return (
    <div
      className="bubble-user"
      style={{
        top: turn.messageY,
        opacity: Math.min(1, travel * 3),
        transform: `translateY(${offset}px) scale(${mix(0.94, 1, Math.min(1, travel))})`,
      }}
    >
      {turn.prompt}
    </div>
  );
}

function Reply({ turn, index }: { turn: Laid; index: number }) {
  const frame = useCurrentFrame();
  // The first avatar is the reveal snail coming to rest, so it appears the moment the reveal hands off.
  const avatarAt = index === 0 ? handOff : turn.reply - 0.05;
  const arrive = settle(frame, turn.reply);
  return (
    <>
      {frame >= frames(avatarAt) ? (
        <SnailFrame placement={avatarFor(turn)} tight={1} style={{ opacity: index === 0 ? 1 : tween(frame, avatarAt, 0.25) }} />
      ) : null}
      {frame >= frames(turn.reply) ? (
        <div
          className="reply"
          style={{
            top: turn.replyY,
            opacity: Math.min(1, arrive * 1.6),
            transform: `translateY(${(1 - arrive) * 22}px) scale(${mix(0.96, 1, arrive)})`,
          }}
        >
          {turn.render(turn.reply, turn.height)}
        </div>
      ) : null}
    </>
  );
}

function Composer() {
  const frame = useCurrentFrame();
  const enter = tween(frame, composerIn, 0.6);
  const leave = tween(frame, chatOut, 0.45, easeInOut);
  const turn = [...layout].reverse().find((t) => frame >= frames(t.type - 0.12));
  const drafting = turn !== undefined && frame < frames(turn.send);
  const typed = drafting
    ? Math.floor(tween(frame, turn.type, turn.send - typeLead - turn.type, linear) * turn.prompt.length)
    : 0;
  const text = drafting ? turn.prompt.slice(0, typed) : "";
  const focus = turn === undefined ? 0 : tween(frame, turn.type - 0.12, 0.16) * (1 - tween(frame, turn.send, 0.16));
  const pressed = turn !== undefined && frame >= frames(turn.send - 0.05) && frame < frames(turn.send + 0.06);
  const caret = drafting && (typed < turn.prompt.length || Math.floor(frame / 30) % 2 === 0);

  return (
    <div
      className="composer"
      style={{
        opacity: Math.min(1, enter * 1.4) * (1 - leave),
        transform: `translateY(${(1 - enter) * 24 + leave * 24}px)`,
        boxShadow: "var(--clay-shadow)",
      }}
    >
      {focus > 0 ? <div className="layer" style={{ borderRadius: "inherit", boxShadow: "var(--clay-focus)", opacity: focus }} /> : null}
      <div className="composer-text">
        {text ? <span>{text}</span> : focus > 0.5 ? null : <span className="muted">Ask Pecu about your wallet…</span>}
        {caret ? <span className="caret" /> : null}
      </div>
      <div
        className="send"
        style={{ opacity: text ? 1 : 0.45, transform: pressed ? "translateY(1px) scale(0.94)" : undefined }}
      >
        <ArrowUp size={18} strokeWidth={2.4} />
      </div>
    </div>
  );
}

/** The web agent's conversation: one thread that scrolls as each new message is sent. */
export function Chat() {
  const frame = useCurrentFrame();
  const scroll = scrollAt(frame);
  const leave = tween(frame, chatOut, 0.45, easeInOut);
  const mask = "linear-gradient(to bottom, transparent 16px, black 46px)";
  return (
    <>
      <RevealSnail firstAvatar={firstAvatar} />
      <div
        className="layer"
        style={{ maskImage: mask, WebkitMaskImage: mask, opacity: 1 - leave, transform: `translateY(${-leave * 24}px)` }}
      >
        <div className="layer" style={{ transform: `translateY(${TOP - scroll}px)` }}>
          {layout.map((turn, i) => (
            <div key={turn.key}>
              <Message turn={turn} scroll={scroll} />
              <Reply turn={turn} index={i} />
            </div>
          ))}
        </div>
      </div>
      <Composer />
    </>
  );
}
