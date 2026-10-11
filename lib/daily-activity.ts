import { prisma } from "@/lib/prisma";
import { convertMinor, toMajorUnits, type CurrencyLike } from "@/lib/currency";

export type DateRange = { gte: Date; lt: Date };

export type ActivityGain = {
  id: string;
  date: Date;
  amountMinor: number;
  currencyCode: string;
  chatterName: string;
  walletName: string;
  walletIcon: string | null;
  walletLogoUrl: string | null;
};

export type ActivityExpense = {
  id: string;
  date: Date;
  amountMinor: number;
  currencyCode: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryLogoUrl: string | null;
  walletName: string;
  note: string | null;
};

export async function getGainsInRange(range: DateRange, chatterId?: string): Promise<ActivityGain[]> {
  const gains = await prisma.gain.findMany({
    where: { date: range, ...(chatterId ? { chatterId } : {}) },
    include: { chatter: true, wallet: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return gains.map((g) => ({
    id: g.id,
    date: g.date,
    amountMinor: Number(g.amountMinor),
    currencyCode: g.currencyCode,
    chatterName: g.chatter.name,
    walletName: g.wallet.name,
    walletIcon: g.wallet.icon,
    walletLogoUrl: g.wallet.logoUrl,
  }));
}

export async function getExpensesInRange(range: DateRange): Promise<ActivityExpense[]> {
  const expenses = await prisma.expense.findMany({
    where: { date: range },
    include: { category: true, wallet: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return expenses.map((e) => ({
    id: e.id,
    date: e.date,
    amountMinor: Number(e.amountMinor),
    currencyCode: e.currencyCode,
    categoryName: e.category.name,
    categoryIcon: e.category.icon,
    categoryLogoUrl: e.category.logoUrl,
    walletName: e.wallet.name,
    note: e.note,
  }));
}

export type GroupTotal = { label: string; total: number; count: number };

/** Sums rows per label, converted to `targetCode` (major units), biggest first — used for "par plateforme" / "par catégorie". */
export function groupTotals<T extends { amountMinor: number; currencyCode: string }>(
  rows: T[],
  labelOf: (row: T) => string,
  targetCode: string,
  currencies: CurrencyLike[]
): GroupTotal[] {
  const groups = new Map<string, GroupTotal>();
  for (const row of rows) {
    const label = labelOf(row);
    const group = groups.get(label) ?? { label, total: 0, count: 0 };
    group.total += toMajorUnits(convertMinor(row.amountMinor, row.currencyCode, targetCode, currencies));
    group.count += 1;
    groups.set(label, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}
