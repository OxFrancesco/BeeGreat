// Ported from vercel/ai-elements packages/elements/src/prompt-input.tsx.
// Keeps the form, textarea (Enter submits, Shift+Enter breaks, IME-safe),
// footer, tools and submit button. Attachments, speech, model selectors and
// the AI SDK ChatStatus are left out; Pecu's backend is request/response.
import { ArrowUpIcon, Loader2Icon, XIcon } from "lucide-react";
import type {
  ComponentProps,
  FormEvent,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PromptInputMessage = { text: string };
export type PromptInputStatus = "ready" | "submitted" | "error";

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void;
};

export const PromptInput = ({ className, onSubmit, ...props }: PromptInputProps) => {
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = String(new FormData(form).get("message") ?? "").trim();
      if (!text) return;
      onSubmit({ text }, event);
    },
    [onSubmit],
  );
  return (
    <form
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border bg-background shadow-xs",
        className,
      )}
      onSubmit={handleSubmit}
      {...props}
    />
  );
};

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("contents", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key !== "Enter") return;
      if (isComposing || event.nativeEvent.isComposing || event.shiftKey) return;
      event.preventDefault();
      const { form } = event.currentTarget;
      const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit?.disabled) return;
      form?.requestSubmit();
    },
    [onKeyDown, isComposing],
  );
  return (
    <Textarea
      className={cn(
        "field-sizing-content max-h-48 min-h-14 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0",
        className,
      )}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputFooterProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <div
    className={cn("flex items-center justify-between gap-2 px-2 pb-2", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: PromptInputStatus;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status = "ready",
  children,
  ...props
}: PromptInputSubmitProps) => {
  let icon = <ArrowUpIcon className="size-4" />;
  if (status === "submitted") icon = <Loader2Icon className="size-4 animate-spin" />;
  else if (status === "error") icon = <XIcon className="size-4" />;
  return (
    <Button
      aria-label="Send"
      className={cn("rounded-full", className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? icon}
    </Button>
  );
};
