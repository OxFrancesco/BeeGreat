import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { MessageAction } from "./ai-elements/message";

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <MessageAction
      className={className}
      label={
        state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Couldn't copy"
            : label
      }
      onClick={() => {
        if (timer.current) clearTimeout(timer.current);
        setState("idle");
        void navigator.clipboard.writeText(text).then(
          () => {
            setState("copied");
            timer.current = setTimeout(() => setState("idle"), 1600);
          },
          () => setState("failed"),
        );
      }}
    >
      {state === "copied" ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </MessageAction>
  );
}
