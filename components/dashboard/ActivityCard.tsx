import { Card, CardTitle } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { AmountWithEquivalents } from "@/components/ui/AmountWithEquivalents";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { StatTile } from "@/components/ui/StatTile";
import { TxRow } from "@/components/ui/TxRow";
import { DateFilterBar } from "./DateFilterBar";
import { equivalentLabel, formatMajor, sumConvertedMinor, toMajorUnits, type CurrencyLike } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { groupTotals, type ActivityExpense, type ActivityGain, type GroupTotal } from "@/lib/daily-activity";

type Props = {
  periodLabel: string;
  isMonth: boolean;
  gains: ActivityGain[];
  /** Omit for chatters: they never see expenses. */
  expenses?: ActivityExpense[];
  showChatterName: boolean;
  baseCode: string;
  currencies: CurrencyLike[];
  displayCodes: string[];
};

export function ActivityCard({ periodLabel, isMonth, gains, expenses, showChatterName, baseCode, currencies, displayCodes }: Props) {
  const gainsTotal = toMajorUnits(sumConvertedMinor(gains, baseCode, currencies));
  const byPlatform = groupTotals(gains, (g) => g.walletName, baseCode, currencies);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Activité — {periodLabel}</CardTitle>
        <DateFilterBar />
      </div>

      <div className={`mt-5 grid grid-cols-1 gap-8 ${expenses ? "lg:grid-cols-2" : ""}`}>
        <section className="space-y-4">
          <SectionTitle>Gains</SectionTitle>
          <StatTile label="Total gains" tone="success">
            <AmountWithEquivalents value={gainsTotal} currencyCode={baseCode} currencies={currencies} otherCodes={displayCodes} sign="positive" size="xl" />
          </StatTile>
          <Breakdown title="Par plateforme" groups={byPlatform} baseCode={baseCode} />
          <div className="space-y-2">
            {gains.length === 0 ? (
              <p className="text-sm text-muted">Aucun gain sur cette période.</p>
            ) : (
              gains.map((g) => {
                const value = toMajorUnits(g.amountMinor);
                return (
                  <TxRow
                    key={g.id}
                    leading={<LogoCircle icon={g.walletIcon} logoUrl={g.walletLogoUrl} />}
                    title={g.walletName}
                    subtitle={[showChatterName ? g.chatterName : null, isMonth ? formatDate(g.date) : null].filter(Boolean).join(" · ") || undefined}
                    amount={<Amount value={value} currencyCode={g.currencyCode} sign="positive" />}
                    eq={equivalentLabel(value, g.currencyCode, currencies)}
                  />
                );
              })
            )}
          </div>
        </section>

        {expenses && <ExpensesSection expenses={expenses} isMonth={isMonth} baseCode={baseCode} currencies={currencies} displayCodes={displayCodes} />}
      </div>
    </Card>
  );
}

function ExpensesSection({
  expenses,
  isMonth,
  baseCode,
  currencies,
  displayCodes,
}: {
  expenses: ActivityExpense[];
  isMonth: boolean;
  baseCode: string;
  currencies: CurrencyLike[];
  displayCodes: string[];
}) {
  const total = toMajorUnits(sumConvertedMinor(expenses, baseCode, currencies));
  const byCategory = groupTotals(expenses, (e) => e.categoryName, baseCode, currencies);

  return (
    <section className="space-y-4">
      <SectionTitle>Dépenses</SectionTitle>
      <StatTile label="Total dépenses" tone="danger">
        <AmountWithEquivalents value={total} currencyCode={baseCode} currencies={currencies} otherCodes={displayCodes} sign="negative" size="xl" />
      </StatTile>
      <Breakdown title="Par catégorie" groups={byCategory} baseCode={baseCode} />
      <div className="space-y-2">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted">Aucune dépense sur cette période.</p>
        ) : (
          expenses.map((e) => {
            const value = toMajorUnits(e.amountMinor);
            return (
              <TxRow
                key={e.id}
                leading={<LogoCircle icon={e.categoryIcon} logoUrl={e.categoryLogoUrl} />}
                title={e.categoryName}
                subtitle={[e.walletName, isMonth ? formatDate(e.date) : null, e.note].filter(Boolean).join(" · ")}
                amount={<Amount value={value} currencyCode={e.currencyCode} sign="negative" />}
                eq={equivalentLabel(value, e.currencyCode, currencies)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[15px] font-medium text-foreground">{children}</h4>;
}

function Breakdown({ title, groups, baseCode }: { title: string; groups: GroupTotal[]; baseCode: string }) {
  if (groups.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-muted">{title}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {groups.map((group) => (
          <div key={group.label} className="rounded-2xl bg-tile p-3.5">
            <p className="truncate text-[13px] text-muted">{group.label}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[17px] font-semibold tabular-nums">{formatMajor(group.total, baseCode)}</span>
              <span className="text-xs text-muted">· {group.count}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
