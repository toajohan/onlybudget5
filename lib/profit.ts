import { prisma } from "@/lib/prisma";
import { sumConvertedMinor, toMajorUnits, type CurrencyLike } from "@/lib/currency";

/** All amounts returned here are in MAJOR units of `baseCode` (ready to format/display or convert with convertAmount). */
export async function computeNetProfit(baseCode: string, currencies: CurrencyLike[]) {
  const [gains, expenses] = await Promise.all([
    prisma.gain.findMany({ select: { amountMinor: true, currencyCode: true } }),
    prisma.expense.findMany({ select: { amountMinor: true, currencyCode: true } }),
  ]);

  const totalGains = toMajorUnits(sumConvertedMinor(gains, baseCode, currencies));
  const totalExpenses = toMajorUnits(sumConvertedMinor(expenses, baseCode, currencies));
  const netProfit = totalGains - totalExpenses;

  return { totalGains, totalExpenses, netProfit };
}

export type AssociateShare = {
  id: string;
  name: string;
  profitSharePercent: number | null;
  shareAmount: number;
};

/** Net profit (gains - expenses), recomputed live from the ledger, split between active associates by their configured percentage. */
export async function computeAssociateShares(baseCode: string, currencies: CurrencyLike[]) {
  const { netProfit, totalGains, totalExpenses } = await computeNetProfit(baseCode, currencies);
  const associates = await prisma.user.findMany({
    where: { role: "ASSOCIE", active: true },
    select: { id: true, name: true, profitSharePercent: true },
    orderBy: { createdAt: "asc" },
  });

  const totalPercent = associates.reduce((sum, a) => sum + (a.profitSharePercent ?? 0), 0);
  const shares: AssociateShare[] = associates.map((a) => ({
    ...a,
    shareAmount: netProfit * ((a.profitSharePercent ?? 0) / 100),
  }));

  return { netProfit, totalGains, totalExpenses, shares, totalPercent };
}
