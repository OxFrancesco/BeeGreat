import { useEffect, useRef, useState } from "react";
import idleHevc from "@/assets/mascot/idle.hevc.mp4?url";
import idleWebm from "@/assets/mascot/idle.webm?url";
import idleStill from "@/assets/mascot/idle.webp?url";
import thinkingHevc from "@/assets/mascot/thinking.hevc.mp4?url";
import thinkingWebm from "@/assets/mascot/thinking.webm?url";
import thinkingStill from "@/assets/mascot/thinking.webp?url";
import loadingHevc from "@/assets/mascot/loading.hevc.mp4?url";
import loadingWebm from "@/assets/mascot/loading.webm?url";
import loadingStill from "@/assets/mascot/loading.webp?url";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "loading";

const clips: Record<MascotState, { hevc: string; webm: string; still: string }> = {
  idle: { hevc: idleHevc, webm: idleWebm, still: idleStill },
  thinking: { hevc: thinkingHevc, webm: thinkingWebm, still: thinkingStill },
  loading: { hevc: loadingHevc, webm: loadingWebm, still: loadingStill },
};

// Safari drops the alpha channel from VP9 WebM, so it gets HEVC with alpha.
// Chrome on macOS also claims hvc1 support but renders the alpha layer black,
// which is why this checks the vendor and not only canPlayType.
function pickSource(video: HTMLVideoElement, state: MascotState) {
  const safari =
    /apple/i.test(navigator.vendor) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  if (safari && video.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"')) {
    return clips[state].hevc;
  }
  if (video.canPlayType('video/webm; codecs="vp9"')) return clips[state].webm;
  return null;
}

/**
 * Transparent Blender animations with a 180ms crossfade.
 * Reduced motion and unsupported codecs show the poster.
 */
export function PecuMascot({
  state = "idle",
  className,
}: {
  state?: MascotState;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduce) return;
    const source = pickSource(video, state);
    if (!source) return;
    setLive(false);
    video.src = source;
    video.load();
    video.play().catch(() => {});
    const onPlaying = () => setLive(true);
    video.addEventListener("playing", onPlaying, { once: true });
    return () => video.removeEventListener("playing", onPlaying);
  }, [state, reduce]);
  return (
    <div
      aria-hidden="true"
      className={cn("relative aspect-[4/3] w-full", className)}
      data-state={state}
    >
      <img
        alt=""
        className={cn(
          "absolute inset-0 size-full object-contain transition-opacity duration-[180ms]",
          live && !reduce ? "opacity-0" : "opacity-100",
        )}
        src={clips[state].still}
      />
      {!reduce && (
        <video
          className={cn(
            "absolute inset-0 size-full object-contain transition-opacity duration-[180ms]",
            live ? "opacity-100" : "opacity-0",
          )}
          onError={() => setLive(false)}
          loop
          muted
          playsInline
          preload="auto"
          ref={videoRef}
        />
      )}
    </div>
  );
}
