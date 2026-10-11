import { cn } from "@/lib/cn";

/** One list row: round logo, title + small subtitle, right-aligned amount with its conversion underneath. */
export function TxRow({
  leading,
  title,
  subtitle,
  amount,
  eq,
  action,
  wrapTitle,
  className,
}: {
  leading: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  amount?: React.ReactNode;
  eq?: React.ReactNode;
  action?: React.ReactNode;
  /** Let a long sentence wrap (audit lines) instead of truncating it. */
  wrapTitle?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[72px] items-center gap-3 rounded-3xl bg-tile px-3.5 py-2.5", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <p className={cn("text-[15px] font-medium text-foreground", wrapTitle ? "break-words" : "truncate")}>{title}</p>
        {subtitle && <p className={cn("text-xs text-muted", wrapTitle ? "break-words" : "truncate")}>{subtitle}</p>}
      </div>
      {(amount || eq) && (
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tabular-nums">{amount}</div>
          {eq && <div className="text-xs text-muted tabular-nums">{eq}</div>}
        </div>
      )}
      {action}
    </div>
  );
}
