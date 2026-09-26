import { motion, useReducedMotion } from "motion/react";
import { MessageResponse } from "./ai-elements/message";

/**
 * Live markdown grows in place; legacy servers can still send complete paragraphs.
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
          <MessageResponse streaming>{paragraph}</MessageResponse>
        </motion.div>
      ))}
    </>
  );
}
