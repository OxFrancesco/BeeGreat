// Ported from vercel/ai-elements packages/elements/src/confirmation.tsx.
// Upstream keys off the AI SDK tool approval states. Pecu's backend stores an
// unsigned plan with its own lifecycle, so the context carries that state
// instead: pending and executing still want the user's answer, succeeded is
// accepted, and failed/cancelled/expired are rejected.
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmationState =
  | "pending"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

const ConfirmationContext = createContext<{ state: ConfirmationState } | null>(null);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error("Confirmation components must be used within Confirmation");
  return context;
};

const requested = new Set<ConfirmationState>(["pending", "executing"]);
const rejected = new Set<ConfirmationState>(["failed", "cancelled", "expired"]);

export type ConfirmationProps = ComponentProps<"div"> & { state: ConfirmationState };

export const Confirmation = ({ className, state, ...props }: ConfirmationProps) => {
  const value = useMemo(() => ({ state }), [state]);
  return (
    <ConfirmationContext.Provider value={value}>
      <div
        className={cn("flex flex-col gap-3 rounded-2xl border p-4", className)}
        data-state={state}
        role="group"
        {...props}
      />
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationTitleProps = ComponentProps<"div">;

export const ConfirmationTitle = ({ className, ...props }: ConfirmationTitleProps) => (
  <div className={cn("text-sm", className)} {...props} />
);

export const ConfirmationRequest = ({ children }: { children?: ReactNode }) => {
  const { state } = useConfirmation();
  return requested.has(state) ? children : null;
};

export const ConfirmationAccepted = ({ children }: { children?: ReactNode }) => {
  const { state } = useConfirmation();
  return state === "succeeded" ? children : null;
};

export const ConfirmationRejected = ({ children }: { children?: ReactNode }) => {
  const { state } = useConfirmation();
  return rejected.has(state) ? children : null;
};

export type ConfirmationActionsProps = ComponentProps<"div">;

export const ConfirmationActions = ({ className, ...props }: ConfirmationActionsProps) => {
  const { state } = useConfirmation();
  if (!requested.has(state)) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2 self-end", className)}
      {...props}
    />
  );
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = (props: ConfirmationActionProps) => (
  <Button className="h-9 px-4 text-sm" type="button" {...props} />
);
