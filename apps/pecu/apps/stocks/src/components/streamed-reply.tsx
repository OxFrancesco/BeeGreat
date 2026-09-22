import { motion, useReducedMotion } from "motion/react";
import { MessageResponse } from "./ai-elements/message";
import { Shimmer } from "./ai-elements/shimmer";

/**
 * The reply Pecu is still writing: each finished paragraph enters once and
 * stays put; the shimmer under the last one says more is coming. The final
 * stored reply replaces the whole block when the turn completes.
 */
export function StreamedReply({ paragraphs }: { paragraphs: readonly string[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <motion.div
          key={index}
          initial={reducedMotion ? false : { opacity: 0, transform: "translateY(4px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
        >
          <MessageResponse>{paragraph}</MessageResponse>
        </motion.div>
      ))}
      <Shimmer className="pecu-shimmer" duration={1.6}>
        Pecu is working on it
      </Shimmer>
    </>
  );
}
