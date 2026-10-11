"use client";

import { cn } from "@/lib/cn";

export type SegmentItem<T extends string> = { value: T; label: React.ReactNode; ariaLabel?: string };

/** Pill switch: the active choice is a solid white pill. `glass` is the translucent variant used on top of the red hero card. */
export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = "dark",
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "dark" | "glass";
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-full p-0.5", variant === "glass" ? "bg-black/40" : "bg-tile", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            aria-label={item.ariaLabel}
            onClick={() => onChange(item.value)}
            className={cn(
              "h-11 min-w-11 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-white text-black" : "text-foreground hover:bg-white/10"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
