import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { computeAssociateShares } from "@/lib/profit";
import { getGainsSeries } from "@/lib/chart-data";
import { getExpensesInRange, getGainsInRange } from "@/lib/daily-activity";
import { sumConvertedMinor, toMajorUnits, convertAmount, convertMinor, formatMajor, type CurrencyLike } from "@/lib/currency";
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
import { Card, CardTitle } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { AmountWithEquivalents } from "@/components/ui/AmountWithEquivalents";
import { StatTile } from "@/components/ui/StatTile";
import { UserAvatar } from "@/components/layout/UserAvatar";
import { GainsChart } from "@/components/charts/GainsChart";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { Users } from "lucide-react";

const ALL_CODES = ["USD", "EUR", "MGA"];

type SearchParams = { date?: string; month?: string; mode?: string; cur?: string };

/** "≈ 1 086,01 €" pills shown under the hero amount, one per other currency. */
function heroEquivalents(value: number, baseCode: string, displayCodes: string[], currencies: CurrencyLike[]) {
  return displayCodes
    .filter((code) => code !== baseCode)
    .map((code) => ({ code, text: `≈ ${formatMajor(convertAmount(value, baseCode, code, currencies), code)}` }));
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const currencies = await prisma.currency.findMany();

  // Currency every aggregate figure is shown in (button at the top). Independent from the database's
  // technical rate-anchor currency (Currency.isBase) — see lib/currency.ts.
  const baseCode = ALL_CODES.includes(sp.cur ?? "") ? sp.cur! : "USD";
  const displayCodes = [baseCode, ...ALL_CODES.filter((c) => c !== baseCode)];

  const isMonth = sp.mode === "month";
  const day = validDayOr(sp.date, todayInputValue());
  const month = validMonthOr(sp.month, currentMonthInputValue());
  const range = isMonth ? getMonthRange(month) : getDayRange(day);
  const periodLabel = isMonth ? formatMonthLabel(month) : formatDayLabel(day);

  if (user.role === "CHATTEUR") {
    const [dayData, monthData, myGains, periodGains] = await Promise.all([
      getGainsSeries({ chatterId: user.id, granularity: "day", baseCode, currencies }),
      getGainsSeries({ chatterId: user.id, granularity: "month", baseCode, currencies }),
      prisma.gain.findMany({ where: { chatterId: user.id }, select: { amountMinor: true, currencyCode: true } }),
      getGainsInRange(range, user.id),
    ]);
    const myTotal = toMajorUnits(sumConvertedMinor(myGains, baseCode, currencies));

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Tableau de bord</h1>
          <p className="text-sm text-white/70">Voici le résumé de vos gains.</p>
        </div>
        <HeroCard
          label="Total gains"
          value={myTotal}
          currencyCode={baseCode}
          equivalents={heroEquivalents(myTotal, baseCode, displayCodes, currencies)}
        />
        <ActivityCard
          periodLabel={periodLabel}
          isMonth={isMonth}
          gains={periodGains}
          showChatterName={false}
          baseCode={baseCode}
          currencies={currencies}
          displayCodes={displayCodes}
        />
        <Card>
          <CardTitle>Mes gains dans le temps</CardTitle>
          <div className="mt-4">
            <GainsChart dayData={dayData} monthData={monthData} currencyCode={baseCode} />
          </div>
        </Card>
      </div>
    );
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
      return { chatter, totalBaseMajor: toMajorUnits(totalBaseMinor) };
    })
    .sort((a, b) => b.totalBaseMajor - a.totalBaseMajor);

  const totalPercentOk = Math.round(shareData.totalPercent) === 100;

  // On a phone everything stacks in reading order; on a large screen the chart moves up next to the hero card.
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-sm text-white/70">Vue d&apos;ensemble de l&apos;agence.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <HeroCard
          className="lg:order-1 lg:col-span-5"
          label="Bénéfice net"
          value={shareData.netProfit}
          currencyCode={baseCode}
          equivalents={heroEquivalents(shareData.netProfit, baseCode, displayCodes, currencies)}
        />

        <div className="lg:order-3 lg:col-span-12">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            <StatTile label="Total gains" tone="success">
              <AmountWithEquivalents value={shareData.totalGains} currencyCode={baseCode} currencies={currencies} otherCodes={displayCodes} sign="positive" />
            </StatTile>
            <StatTile label="Total dépenses" tone="danger">
              <AmountWithEquivalents value={shareData.totalExpenses} currencyCode={baseCode} currencies={currencies} otherCodes={displayCodes} sign="negative" />
            </StatTile>
            {shareData.shares.map((share) => (
              <StatTile key={share.id} label={`Part de ${share.name} (${share.profitSharePercent ?? 0}%)`}>
                <AmountWithEquivalents value={share.shareAmount} currencyCode={baseCode} currencies={currencies} otherCodes={displayCodes} />
              </StatTile>
            ))}
          </div>
          {!totalPercentOk && (
            <p className="mt-4 rounded-2xl bg-ember/15 px-4 py-3 text-sm text-ember">
              Les pourcentages des associés totalisent {Math.round(shareData.totalPercent)}% (au lieu de 100%). Ajustez-les
              dans la page Équipe.
            </p>
          )}
        </div>

        <div className="lg:order-4 lg:col-span-12">
          <ActivityCard
            periodLabel={periodLabel}
            isMonth={isMonth}
            gains={periodGains}
            expenses={periodExpenses}
            showChatterName
            baseCode={baseCode}
            currencies={currencies}
            displayCodes={displayCodes}
          />
        </div>

        <Card className="lg:order-2 lg:col-span-7">
          <CardTitle>Gains de l&apos;agence dans le temps</CardTitle>
          <div className="mt-4">
            <GainsChart dayData={dayData} monthData={monthData} currencyCode={baseCode} />
          </div>
        </Card>

        <Card className="lg:order-5 lg:col-span-12">
          <CardTitle>Par chatteur</CardTitle>
          {chatterTotals.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center text-muted">
              <Users className="h-6 w-6" />
              <p className="text-sm">Aucun chatteur pour l&apos;instant. Ajoutez-en un depuis la page Équipe.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {chatterTotals.map(({ chatter, totalBaseMajor }) => (
                <div key={chatter.id} className="flex items-center gap-3 rounded-3xl bg-tile px-3.5 py-2.5">
                  <UserAvatar name={chatter.name} avatarUrl={chatter.avatarUrl} size={40} />
                  <span className="flex-1 text-[15px] font-medium text-foreground">{chatter.name}</span>
                  <Amount value={totalBaseMajor} currencyCode={baseCode} sign="positive" className="text-[15px] font-semibold" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
