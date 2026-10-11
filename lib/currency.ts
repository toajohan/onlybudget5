export type CurrencyLike = {
  code: string;
  symbol: string;
  rateToBase: number;
  isBase: boolean;
};

export const MINOR_UNIT_FACTOR = 100;

export function toMinorUnits(majorAmount: number): bigint {
  return BigInt(Math.round(majorAmount * MINOR_UNIT_FACTOR));
}

export function toMajorUnits(minorAmount: bigint | number): number {
  const n = typeof minorAmount === "bigint" ? Number(minorAmount) : minorAmount;
  return n / MINOR_UNIT_FACTOR;
}

/** Converts an amount from one currency to another via each currency's rate to the shared base currency. Unit-agnostic: pass minor or major units, get the same scale back. */
export function convertAmount(amount: number, fromCode: string, toCode: string, currencies: CurrencyLike[]): number {
  if (fromCode === toCode) return amount;
  const from = currencies.find((c) => c.code === fromCode);
  const to = currencies.find((c) => c.code === toCode);
  if (!from || !to) throw new Error(`Devise inconnue: ${fromCode} -> ${toCode}`);
  return (amount * from.rateToBase) / to.rateToBase;
}

/** Converts an amount in minor units of `fromCode` into minor units of `toCode`. */
export function convertMinor(
  amountMinor: bigint | number,
  fromCode: string,
  toCode: string,
  currencies: CurrencyLike[]
): number {
  const amount = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
  return convertAmount(amount, fromCode, toCode, currencies);
}

export function sumConvertedMinor(
  items: { amountMinor: bigint | number; currencyCode: string }[],
  toCode: string,
  currencies: CurrencyLike[]
): number {
  return items.reduce((sum, item) => sum + convertMinor(item.amountMinor, item.currencyCode, toCode, currencies), 0);
}

const CURRENCY_DISPLAY: Record<string, { prefix?: string; suffix: string; decimals: number }> = {
  EUR: { suffix: " €", decimals: 2 },
  USD: { prefix: "$", suffix: "", decimals: 2 },
  MGA: { suffix: " Ar", decimals: 0 },
};

/** "≈ $29,57": the amount in the other main currency (dollars, or euros when it already is dollars). Null if a rate is missing. */
export function equivalentLabel(majorAmount: number, currencyCode: string, currencies: CurrencyLike[]): string | null {
  const target = currencyCode === "USD" ? "EUR" : "USD";
  if (!currencies.some((c) => c.code === currencyCode) || !currencies.some((c) => c.code === target)) return null;
  return `≈ ${formatMajor(convertAmount(majorAmount, currencyCode, target, currencies), target)}`;
}

/** An amount split into its display pieces, e.g. USD -> { prefix: "$", number: "1 284,40", suffix: "" }. */
export function formatMajorParts(majorAmount: number, currencyCode: string): { prefix: string; number: string; suffix: string } {
  const display = CURRENCY_DISPLAY[currencyCode];
  const decimals = display?.decimals ?? 2;
  const rounded = Math.round(majorAmount * 10 ** decimals) / 10 ** decimals;
  const number = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
  return { prefix: display?.prefix ?? "", number, suffix: display?.suffix ?? " " + currencyCode };
}

export function formatMajor(majorAmount: number, currencyCode: string): string {
  const { prefix, number, suffix } = formatMajorParts(majorAmount, currencyCode);
  return `${prefix}${number}${suffix}`;
}

export function formatMinor(minorAmount: bigint | number, currencyCode: string): string {
  return formatMajor(toMajorUnits(minorAmount), currencyCode);
}
