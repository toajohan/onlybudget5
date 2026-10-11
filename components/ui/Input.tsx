import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export const INPUT_CLASSES =
  "w-full rounded-2xl border border-border bg-tile px-4 py-3 text-[15px] text-foreground [color-scheme:dark] placeholder:text-muted/80 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(INPUT_CLASSES, className)} {...props} />
);
Input.displayName = "Input";
