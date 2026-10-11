import { formatMajor } from "@/lib/currency";
import { cn } from "@/lib/cn";

type AmountProps = {
  value: number;
  currencyCode: string;
  sign?: "positive" | "negative" | "neutral";
  className?: string;
};

export function Amount({ value, currencyCode, sign = "neutral", className }: AmountProps) {
  const color = sign === "positive" ? "text-success" : sign === "negative" ? "text-danger" : "text-foreground";
  return <span className={cn("tabular-nums", color, className)}>{formatMajor(value, currencyCode)}</span>;
}
