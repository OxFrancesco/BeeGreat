import type { ElementType } from "react";
import { memo } from "react";
import { cn } from "@/lib/utils";

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
}

export const Shimmer = memo(function Shimmer({
  children,
  as: Component = "p",
  className,
  duration = 2,
}: TextShimmerProps) {
  return (
    <Component
      className={cn("pecu-thinking-text text-muted-foreground", className)}
      style={{ animationDuration: `${duration}s` }}
    >
      {children}
    </Component>
  );
});
