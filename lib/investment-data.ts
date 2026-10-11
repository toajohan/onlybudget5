import { prisma } from "@/lib/prisma";
import { convertMinor, sumConvertedMinor, toMajorUnits, type CurrencyLike } from "@/lib/currency";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An associate's money, in MAJOR units of `code`:
 * - available: their share of the common accounts (no owner) plus their own accounts (e.g. their Mvola);
 * - monthlyIncome: their share of the agency's net profit, averaged per month over the last 90 days
 *   (or since the first sale, if the agency is younger than that).
 */
export async function getAssociateMoney(
  user: { id: string; profitSharePercent: number | null },
  code: string,
  currencies: CurrencyLike[]
) {
  const share = (user.profitSharePercent ?? 0) / 100;
  const now = Date.now();

  const [wallets, firstGain] = await Promise.all([
    prisma.wallet.findMany({
      where: { archived: false, OR: [{ ownerId: null }, { ownerId: user.id }] },
      select: { ownerId: true, balanceMinor: true, currencyCode: true },
    }),
    prisma.gain.findFirst({ orderBy: { date: "asc" }, select: { date: true } }),
  ]);

  const toCode = (w: { balanceMinor: bigint; currencyCode: string }) => convertMinor(w.balanceMinor, w.currencyCode, code, currencies);
  const commonMinor = wallets.filter((w) => w.ownerId === null).reduce((sum, w) => sum + toCode(w), 0);
  const ownMinor = wallets.filter((w) => w.ownerId === user.id).reduce((sum, w) => sum + toCode(w), 0);

  const ageDays = firstGain ? (now - firstGain.date.getTime()) / DAY_MS : 0;
  const windowDays = Math.min(90, Math.max(30, ageDays));
  const since = new Date(now - windowDays * DAY_MS);
  const [gains, expenses] = await Promise.all([
    prisma.gain.findMany({ where: { date: { gte: since } }, select: { amountMinor: true, currencyCode: true } }),
    prisma.expense.findMany({ where: { date: { gte: since } }, select: { amountMinor: true, currencyCode: true } }),
  ]);
  const netMinor = sumConvertedMinor(gains, code, currencies) - sumConvertedMinor(expenses, code, currencies);

  return {
    commonShare: toMajorUnits(commonMinor * share),
    own: toMajorUnits(ownMinor),
    available: toMajorUnits(commonMinor * share + ownMinor),
    monthlyIncome: toMajorUnits(((netMinor * share) / windowDays) * 30),
    sharePercent: user.profitSharePercent ?? 0,
  };
}
