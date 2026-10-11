import type { FeeType } from "@prisma/client";
import type { CurrencyLike } from "@/lib/currency";

export type RouteFeeConfig = {
  feeType: FeeType;
  feePercent: number | null;
  feeFixedMinor: bigint | number | null;
};

export function computeFee(route: RouteFeeConfig, amountSentMinor: number): number {
  switch (route.feeType) {
    case "PERCENT":
      return Math.round(amountSentMinor * ((route.feePercent ?? 0) / 100));
    case "FIXED":
      return Number(route.feeFixedMinor ?? 0);
    case "NONE":
    default:
      return 0;
  }
}

export type TransferComputation = {
  feeAmountMinor: number;
  amountAfterFeeMinor: number; // still in fromCurrency
  amountReceivedMinor: number; // in toCurrency, after conversion
  exchangeRateUsed: number | null;
};

/** Computes the fee, and net amount received on the destination wallet, for a withdrawal/transfer along a configured route. */
export function computeTransfer(
  route: RouteFeeConfig,
  amountSentMinor: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  currencies: CurrencyLike[]
): TransferComputation {
  const feeAmountMinor = computeFee(route, amountSentMinor);
  const amountAfterFeeMinor = amountSentMinor - feeAmountMinor;

  if (fromCurrencyCode === toCurrencyCode) {
    return {
      feeAmountMinor,
      amountAfterFeeMinor,
      amountReceivedMinor: Math.round(amountAfterFeeMinor),
      exchangeRateUsed: null,
    };
  }

  const from = currencies.find((c) => c.code === fromCurrencyCode);
  const to = currencies.find((c) => c.code === toCurrencyCode);
  if (!from || !to) throw new Error("Devise inconnue");
  const rate = from.rateToBase / to.rateToBase;
  const amountReceivedMinor = Math.round(amountAfterFeeMinor * rate);

  return { feeAmountMinor, amountAfterFeeMinor, amountReceivedMinor, exchangeRateUsed: rate };
}
