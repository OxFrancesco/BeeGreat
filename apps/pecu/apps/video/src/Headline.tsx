import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, rise, tween } from "./motion";
import { markerAt, wordStagger, type Headline as HeadlineCopy } from "./timeline";

type Segment = { words: string[]; marked: boolean };

const segments = (text: string): Segment[] =>
  text
    .split("*")
    .map((part, index) => ({ words: part.trim().split(/\s+/).filter(Boolean), marked: index % 2 === 1 }))
    .filter((segment) => segment.words.length > 0);

/** Words rise out of their own masks one after another, then an amber clay marker sweeps behind the key phrase. */
export function Headline({
  copy,
  size,
  style,
  align = "left",
}: {
  copy: HeadlineCopy;
  size: number;
  style?: CSSProperties;
  align?: "left" | "center";
}) {
  const frame = useCurrentFrame();
  const { enter, exit } = copy;
  const marker = markerAt(copy);
  let index = 0;

  const word = (text: string) => {
    const i = index++;
    const arrive = tween(frame, enter + i * wordStagger, 0.7);
    const leave = tween(frame, exit + i * 0.025, 0.45, easeInOut);
    return (
      <span className="word-mask" key={i}>
        <span className="word" style={{ transform: `translateY(${(1 - arrive - leave) * 140}%)` }}>
          {text}
        </span>
      </span>
    );
  };

  const sweep = tween(frame, marker, 0.5, easeInOut);
  const unsweep = tween(frame, exit, 0.35, easeInOut);
  const sub = tween(frame, enter + 0.35, 0.6);
  const subOut = tween(frame, exit, 0.35, easeInOut);

  return (
    <div style={{ position: "absolute", textAlign: align, ...style }}>
      <h2 className="headline" style={{ fontSize: size }}>
        {segments(copy.text).map((segment, s) => {
          const words = segment.words.flatMap((text, w) => (w === 0 ? [word(text)] : [" ", word(text)]));
          const gap = s > 0 ? " " : null;
          if (!segment.marked) return [gap, ...words];
          return [
            gap,
            <span className="mark" key={`mark-${s}`}>
              <span
                className="marker"
                style={{
                  transform: `scaleX(${unsweep > 0 ? 1 - unsweep : sweep})`,
                  transformOrigin: unsweep > 0 ? "100% 50%" : "0% 50%",
                }}
              />
              {words}
            </span>,
          ];
        })}
      </h2>
      {copy.sub ? (
        <p className="headline-sub" style={{ ...rise(sub, 8), opacity: Math.min(1, sub * 1.4) * (1 - subOut) }}>
          {copy.sub}
        </p>
      ) : null}
    </div>
  );
}
