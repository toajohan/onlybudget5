import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { convertMinor, type CurrencyLike } from "@/lib/currency";
import { addDays, addMonths, currentMonthInputValue, todayInputValue } from "@/lib/date";

export type ChartPoint = { label: string; value: number };

type Bucket = { key: string; label: string; value: number };

/** Daily (last 30 days) or monthly (last 12 months) totals of gains, converted to `baseCode` major units. */
export async function getGainsSeries(options: {
  chatterId?: string;
  granularity: "day" | "month";
  baseCode: string;
  currencies: CurrencyLike[];
}): Promise<ChartPoint[]> {
  const { chatterId, granularity, baseCode, currencies } = options;

  // Buckets are plain calendar strings anchored on Madagascar's "today"; stored gain dates are UTC midnight of the chosen day.
  const buckets: Bucket[] = [];
  if (granularity === "day") {
    const today = todayInputValue();
    for (let i = 29; i >= 0; i--) {
      const key = addDays(today, -i);
      buckets.push({ key, label: format(new Date(`${key}T12:00:00Z`), "d MMM", { locale: fr }), value: 0 });
    }
  } else {
    const thisMonth = currentMonthInputValue();
    for (let i = 11; i >= 0; i--) {
      const key = addMonths(thisMonth, -i);
      buckets.push({ key, label: format(new Date(`${key}-15T12:00:00Z`), "MMM yy", { locale: fr }), value: 0 });
    }
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  const since = new Date(granularity === "day" ? buckets[0].key : `${buckets[0].key}-01`);

  const gains = await prisma.gain.findMany({
    where: { ...(chatterId ? { chatterId } : {}), date: { gte: since } },
    select: { amountMinor: true, currencyCode: true, date: true },
  });

  for (const gain of gains) {
    const day = gain.date.toISOString().slice(0, 10);
    const bucket = bucketByKey.get(granularity === "day" ? day : day.slice(0, 7));
    if (!bucket) continue;
    const convertedMinor = convertMinor(gain.amountMinor, gain.currencyCode, baseCode, currencies);
    bucket.value += convertedMinor / 100;
  }

  return buckets.map((b) => ({ label: b.label, value: Math.round(b.value * 100) / 100 }));
}
