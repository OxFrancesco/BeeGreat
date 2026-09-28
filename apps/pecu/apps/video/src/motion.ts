import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./timeline";

export const frames = (seconds: number) => Math.round(seconds * FPS);

/** Pecu's entrance and on-screen movement curves (apps/pecu/docs/design-system.md#motion). */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
export const linear = (t: number) => t;

/** 0 → 1 over `duration` seconds starting at `start` seconds, clamped on both sides. */
export function tween(frame: number, start: number, duration: number, easing: (t: number) => number = easeOut) {
  const from = frames(start);
  const to = Math.max(from + 1, frames(start + duration));
  return interpolate(frame, [from, to], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** A clay settle: a spring with a little give. 0 before `start`. */
export function settle(frame: number, start: number) {
  const local = frame - frames(start);
  if (local <= 0) return 0;
  return spring({ frame: local, fps: FPS, config: { mass: 1, stiffness: 170, damping: 19 } });
}

export const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/** Rise-in used by most UI pieces: opacity plus a short upward travel. */
export function rise(t: number, distance = 12) {
  return { opacity: Math.min(1, t * 1.4), transform: `translateY(${(1 - t) * distance}px)` };
}

const number = (digits: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatAmount = (value: number, digits: number) => number(digits).format(value);
