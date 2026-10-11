"use client";

import { ICON_OPTIONS, resolveIcon } from "./registry";
import { cn } from "@/lib/cn";

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-2 rounded-2xl bg-tile p-2 sm:grid-cols-10">
      {ICON_OPTIONS.map((key) => {
        const Icon = resolveIcon(key);
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
              selected ? "border-white bg-white/15 text-white" : "border-transparent text-muted hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
