import { cn } from "@/lib/cn";

/** Small rounded tile: muted label on top, value underneath. `tone` tints it green (gains) or orange (expenses). */
export function StatTile({
  label,
  children,
  tone,
  className,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "success" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl p-4 md:p-5",
        tone === "success" ? "tint-success" : tone === "danger" ? "tint-danger" : "bg-tile",
        className
      )}
    >
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
