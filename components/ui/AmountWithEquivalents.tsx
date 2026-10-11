import { Amount } from "./Amount";
import { convertAmount, formatMajor, type CurrencyLike } from "@/lib/currency";

/** Shows one amount in its primary currency, plus small muted equivalents in the other currencies. */
export function AmountWithEquivalents({
  value,
  currencyCode,
  currencies,
  otherCodes,
  sign,
  size = "lg",
}: {
  value: number;
  currencyCode: string;
  currencies: CurrencyLike[];
  otherCodes: string[];
  sign?: "positive" | "negative" | "neutral";
  size?: "lg" | "xl";
}) {
  const equivalents = otherCodes.filter((c) => c !== currencyCode);

  return (
    <div>
      <p className={size === "xl" ? "text-[26px] font-medium tracking-tight" : "text-xl font-semibold tracking-tight"}>
        <Amount value={value} currencyCode={currencyCode} sign={sign} />
      </p>
      {equivalents.length > 0 && (
        <p className="mt-0.5 text-xs text-muted">
          {equivalents.map((c) => `≈ ${formatMajor(convertAmount(value, currencyCode, c, currencies), c)}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
