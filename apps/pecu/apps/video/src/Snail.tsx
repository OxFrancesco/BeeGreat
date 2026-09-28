import type { CSSProperties } from "react";
import { Img, OffthreadVideo, useCurrentFrame } from "remotion";
import revealVideo from "../../site/site/pecu-assets/mascot/pecu-reveal.webm";
import revealStill from "../../site/site/pecu-assets/mascot/pecu-reveal.webp";
import { easeInOut, frames, mix, tween } from "./motion";
import { reveal, revealTime, turns } from "./timeline";

export type Placement = { cx: number; cy: number; w: number };

/** The snail's centre and width inside the 960×540 reveal frame. */
const SNAIL: Placement = { cx: 717, cy: 241.5, w: 313 };

/** Empty-chat hero, then the avatar beside the first reply (thread coordinates at scroll 0). */
export const HERO: Placement = { cx: 660, cy: 236, w: 226 };
export const AVATAR_OFFSET = { cx: 445, dy: 35, w: 64 };

const lerp = (a: Placement, b: Placement, t: number): Placement => ({
  cx: mix(a.cx, b.cx, t),
  cy: mix(a.cy, b.cy, t),
  w: mix(a.w, b.w, t),
});

/**
 * Draws the reveal frame so its snail lands on `placement`. `tight` closes an elliptical mask
 * around the snail, which hides the letters and the render's faint shadow-catcher floor.
 */
export function SnailFrame({
  placement,
  tight,
  video = false,
  style,
}: {
  placement: Placement;
  tight: number;
  video?: boolean;
  style?: CSSProperties;
}) {
  const scale = placement.w / SNAIL.w;
  const feather = 12 * Math.min(1, tight * 3);
  const edges = (direction: string) =>
    `linear-gradient(${direction}, transparent, black ${feather}%, black ${100 - feather}%, transparent)`;
  const mask = [
    `radial-gradient(ellipse ${mix(1400, 232, tight)}px ${mix(1000, 190, tight)}px at ${SNAIL.cx}px ${SNAIL.cy}px, black 70%, transparent 100%)`,
    edges("to right"),
    edges("to bottom"),
  ].join(", ");
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 960,
        height: 540,
        transformOrigin: "0 0",
        transform: `translate(${placement.cx - SNAIL.cx * scale}px, ${placement.cy - SNAIL.cy * scale}px) scale(${scale})`,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
        ...style,
      }}
    >
      {video ? (
        <OffthreadVideo
          src={revealVideo}
          transparent
          muted
          playbackRate={reveal.rate}
          trimBefore={frames(reveal.trim)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Img src={revealStill} style={{ width: "100%", height: "100%" }} />
      )}
    </div>
  );
}

/** The snail starts shrinking just before the first message leaves, so the message never crosses it. */
const toAvatarAt = turns.balance.send - 0.12;
/** When the thread's first avatar takes over from the reveal. */
export const handOff = toAvatarAt + 0.55;

/** The opening reveal: the snail writes "Pecu", walks into the empty chat, then becomes the first avatar. */
export function RevealSnail({ firstAvatar }: { firstAvatar: Placement }) {
  const frame = useCurrentFrame();
  if (frame >= frames(handOff)) return null;
  const toHero = tween(frame, reveal.move, 0.75, easeInOut);
  const toAvatar = tween(frame, toAvatarAt, 0.55, easeInOut);
  // The mask closes slightly ahead of the move so the letters and frame edges are gone before it shrinks.
  const tight = tween(frame, reveal.move - 0.15, 0.55, easeInOut);
  const placement = toAvatar > 0 ? lerp(HERO, firstAvatar, toAvatar) : lerp(SNAIL, HERO, toHero);
  return <SnailFrame placement={placement} tight={tight} video={frame < frames(revealTime(reveal.sourceEnd))} />;
}
