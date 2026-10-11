import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/api-auth";
import { computeAssociateShares } from "@/lib/profit";
import { getGainsSeries } from "@/lib/chart-data";
import { getExpensesInRange, getGainsInRange } from "@/lib/daily-activity";
import { sumConvertedMinor, toMajorUnits, convertMinor } from "@/lib/currency";
import {
  currentMonthInputValue,
  formatDayLabel,
  formatMonthLabel,
  getDayRange,
  getMonthRange,
  todayInputValue,
  validDayOr,
  validMonthOr,
} from "@/lib/date";
import { jsonOk } from "@/lib/serialize";

const ALL_CODES = ["USD", "EUR", "MGA"];

/**
 * Same data as the web dashboard page (app/(app)/dashboard/page.tsx), as JSON — for the mobile app. Query params
 * mirror the page's searchParams: cur (display currency), mode ("day" | "month"), date ("YYYY-MM-DD"), month ("YYYY-MM").
 */
export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const requestedCur = url.searchParams.get("cur") ?? "";
  const baseCode = ALL_CODES.includes(requestedCur) ? requestedCur : "USD";
  const isMonth = url.searchParams.get("mode") === "month";
  const day = validDayOr(url.searchParams.get("date") ?? undefined, todayInputValue());
  const month = validMonthOr(url.searchParams.get("month") ?? undefined, currentMonthInputValue());
  const range = isMonth ? getMonthRange(month) : getDayRange(day);
  const periodLabel = isMonth ? formatMonthLabel(month) : formatDayLabel(day);

  const currencies = await prisma.currency.findMany();

  if (auth.role === "CHATTEUR") {
    const [dayData, monthData, myGains, periodGains] = await Promise.all([
      getGainsSeries({ chatterId: auth.id, granularity: "day", baseCode, currencies }),
      getGainsSeries({ chatterId: auth.id, granularity: "month", baseCode, currencies }),
      prisma.gain.findMany({ where: { chatterId: auth.id }, select: { amountMinor: true, currencyCode: true } }),
      getGainsInRange(range, auth.id),
    ]);
    const myTotal = toMajorUnits(sumConvertedMinor(myGains, baseCode, currencies));

    return jsonOk({
      role: "CHATTEUR",
      baseCode,
      currencies,
      periodLabel,
      isMonth,
      myTotal,
      periodGains,
      dayData,
      monthData,
    });
  }

  const [dayData, monthData, shareData, chatters, grouped, periodGains, periodExpenses] = await Promise.all([
    getGainsSeries({ granularity: "day", baseCode, currencies }),
    getGainsSeries({ granularity: "month", baseCode, currencies }),
    computeAssociateShares(baseCode, currencies),
    prisma.user.findMany({ where: { role: "CHATTEUR", active: true }, orderBy: { name: "asc" } }),
    prisma.gain.groupBy({ by: ["chatterId", "currencyCode"], _sum: { amountMinor: true } }),
    getGainsInRange(range),
    getExpensesInRange(range),
  ]);

  const chatterTotals = chatters
    .map((chatter) => {
      const rows = grouped.filter((g) => g.chatterId === chatter.id);
      const totalBaseMinor = rows.reduce(
        (sum, r) => sum + convertMinor(r._sum.amountMinor ?? BigInt(0), r.currencyCode, baseCode, currencies),
        0
      );
      return { id: chatter.id, name: chatter.name, avatarUrl: chatter.avatarUrl, totalBaseMajor: toMajorUnits(totalBaseMinor) };
    })
    .sort((a, b) => b.totalBaseMajor - a.totalBaseMajor);

  return jsonOk({
    role: "ASSOCIE",
    baseCode,
    currencies,
    periodLabel,
    isMonth,
    netProfit: shareData.netProfit,
    totalGains: shareData.totalGains,
    totalExpenses: shareData.totalExpenses,
    shares: shareData.shares,
    totalPercent: shareData.totalPercent,
    chatterTotals,
    periodGains,
    periodExpenses,
    dayData,
    monthData,
  });
}
