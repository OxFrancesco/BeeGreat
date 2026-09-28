import { Loop, OffthreadVideo, useCurrentFrame } from "remotion";
import idleVideo from "../../site/site/pecu-assets/mascot/idle.webm";
import { frames, rise, tween } from "./motion";
import { outro } from "./timeline";

/** Same mask as the Agent's empty-state snail: keeps the contact shadow, drops the render's floor. */
const SNAIL_MASK = "radial-gradient(ellipse 62% 58% at 50% 48%, black 55%, transparent 100%)";

/** The closing frame on the dark surface the Safe tile opened into. */
export function Outro() {
  const frame = useCurrentFrame();
  if (frame < frames(outro.snail - 0.1)) return null;
  const snail = tween(frame, outro.snail, 0.7);
  const letters = "pecu".split("");
  return (
    <div className="layer pecu-theme dark" style={{ background: "none", zIndex: 2 }}>
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 108,
          width: 420,
          height: 315,
          maskImage: SNAIL_MASK,
          WebkitMaskImage: SNAIL_MASK,
          ...rise(snail, 16),
        }}
      >
        <Loop durationInFrames={frames(3)}>
          <OffthreadVideo src={idleVideo} transparent muted style={{ width: "100%", height: "100%" }} />
        </Loop>
      </div>

      <div style={{ position: "absolute", left: 430, top: 142, display: "grid", gap: 18 }}>
        <div className="wordmark" aria-label="pecu">
          {letters.map((letter, i) => (
            <span className="word-mask" key={letter}>
              <span
                className="word"
                style={{ transform: `translateY(${(1 - tween(frame, outro.wordmark + i * 0.06, 0.7)) * 140}%)` }}
              >
                {letter}
              </span>
            </span>
          ))}
        </div>
        <p className="tagline" style={rise(tween(frame, outro.tagline, 0.6), 10)}>
          Your smart ass on-chain friend.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 10, ...rise(tween(frame, outro.actions, 0.6), 10) }}>
          <span className="cta primary">Message @BeeGreatAI on X ↗</span>
          <span className="cta">pecu.app/agent →</span>
        </div>
      </div>

      <p
        className="legal"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 22,
          margin: 0,
          textAlign: "center",
          opacity: tween(frame, outro.legal, 0.6),
        }}
      >
        Pecu is an independent project, not affiliated with Aerodrome, Aave, Nansen or Polymarket.
      </p>
    </div>
  );
}
