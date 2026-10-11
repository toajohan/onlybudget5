import { CheckCircle2, Info, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";
import { requireAssocie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { convertAmount, formatMajor, toMajorUnits, type CurrencyLike } from "@/lib/currency";
import { getAssociateMoney } from "@/lib/investment-data";
import {
  buildAdvice,
  INVESTMENT_TYPE_LABELS,
  PROFILE_RULES,
  RISK_PROFILES,
  type InvestmentType,
  type RiskProfile,
  type Tip,
  type Verdict,
} from "@/lib/investment";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { Amount } from "@/components/ui/Amount";
import { HeroCard } from "@/components/dashboard/HeroCard";
import { InvestmentProfileForm } from "@/components/forms/InvestmentProfileForm";
import { InvestmentForm } from "@/components/forms/InvestmentForm";
import { InvestmentsList, type InvestmentRow } from "@/components/tables/InvestmentsList";
import { cn } from "@/lib/cn";

const ALL_CODES = ["USD", "EUR", "MGA"];
/** Below about this many dollars, splitting money across several investments isn't worth the fees. */
const SMALL_AMOUNT_USD = 50;

const VERDICT_STYLE: Record<Verdict, { className: string; icon: typeof Sparkles }> = {
  INVEST: { className: "bg-success/15 text-success", icon: Sparkles },
  BUILD_RESERVE: { className: "bg-ember/15 text-ember", icon: ShieldAlert },
  KEEP: { className: "bg-ember/15 text-ember", icon: Info },
  SET_UP: { className: "bg-tile text-foreground", icon: Info },
};

const TIP_ICON: Record<Tip["tone"], { icon: typeof Info; className: string }> = {
  good: { icon: CheckCircle2, className: "text-success" },
  warn: { icon: TriangleAlert, className: "text-ember" },
  info: { icon: Info, className: "text-muted" },
};

function heroEquivalents(value: number, baseCode: string, currencies: CurrencyLike[]) {
  return ALL_CODES.filter((code) => code !== baseCode).map((code) => ({
    code,
    text: `≈ ${formatMajor(convertAmount(value, baseCode, code, currencies), code)}`,
  }));
}

export default async function InvestissementPage({ searchParams }: { searchParams: Promise<{ cur?: string }> }) {
  const user = await requireAssocie();
  const sp = await searchParams;
  const baseCode = ALL_CODES.includes(sp.cur ?? "") ? sp.cur! : "USD";

  const [currencies, profileRow, investmentRows] = await Promise.all([
    prisma.currency.findMany(),
    prisma.investmentProfile.findUnique({ where: { userId: user.id } }),
    prisma.investment.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
  ]);
  const money = await getAssociateMoney(user, baseCode, currencies);

  const profile: RiskProfile = RISK_PROFILES.includes(profileRow?.riskProfile as RiskProfile)
    ? (profileRow!.riskProfile as RiskProfile)
    : "EQUILIBRE";
  const profileCurrency = profileRow?.currencyCode ?? "USD";
  const livingInProfileCurrency = profileRow ? toMajorUnits(profileRow.monthlyLivingMinor) : 0;
  const monthlyLiving = convertAmount(livingInProfileCurrency, profileCurrency, baseCode, currencies);

  const investments: InvestmentRow[] = investmentRows.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type as InvestmentType,
    amountMajor: toMajorUnits(i.amountMinor),
    currentValueMajor: i.currentValueMinor == null ? null : toMajorUnits(i.currentValueMinor),
    currencyCode: i.currencyCode as InvestmentRow["currencyCode"],
    date: i.date.toISOString().slice(0, 10),
    note: i.note ?? "",
  }));
  const investedByType: Partial<Record<InvestmentType, number>> = {};
  for (const inv of investments) {
    const value = convertAmount(inv.currentValueMajor ?? inv.amountMajor, inv.currencyCode, baseCode, currencies);
    investedByType[inv.type] = (investedByType[inv.type] ?? 0) + value;
  }

  const advice = buildAdvice({
    available: money.available,
    monthlyIncome: money.monthlyIncome,
    monthlyLiving,
    investedByType,
    profile,
    smallAmount: convertAmount(SMALL_AMOUNT_USD, "USD", baseCode, currencies),
  });
  const fmt = (n: number) => formatMajor(n, baseCode);
  const verdictStyle = VERDICT_STYLE[advice.verdict];
  const VerdictIcon = verdictStyle.icon;
  const monthlyFree = Math.max(0, advice.monthlySurplus - advice.monthlyToReserve - advice.monthlyToInvest);

  return (
    <div className="space-y-6">
      <PageHeader title="Investissement" subtitle="Vos conseils personnels. Vous seul voyez cette page." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <HeroCard
            label="Mon argent disponible"
            value={money.available}
            currencyCode={baseCode}
            equivalents={heroEquivalents(money.available, baseCode, currencies)}
          />
          <p className="-mt-3 px-1 text-xs text-muted">
            Ma part des comptes communs ({money.sharePercent} %) : {fmt(money.commonShare)} · Mes comptes perso : {fmt(money.own)}
          </p>

          <div className={cn("flex gap-3 rounded-3xl p-4 md:p-5", verdictStyle.className)}>
            <VerdictIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-[15px] font-semibold">{advice.headline}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
            <StatTile label="Revenu moyen / mois" tone="success">
              <Amount value={money.monthlyIncome} currencyCode={baseCode} className="text-xl font-semibold" />
            </StatTile>
            <StatTile label="Mes dépenses / mois" tone="danger">
              <Amount value={monthlyLiving} currencyCode={baseCode} className="text-xl font-semibold" />
            </StatTile>
            <StatTile label={`Réserve conseillée (${PROFILE_RULES[profile].reserveMonths} mois)`}>
              <Amount value={advice.reserveTarget} currencyCode={baseCode} className="text-xl font-semibold" />
              <p className={cn("mt-1 text-xs", advice.reserveMissing > 0 ? "text-ember" : "text-success")}>
                {advice.reserveMissing > 0 ? `Il manque ${fmt(advice.reserveMissing)}` : "Complète ✓"}
              </p>
            </StatTile>
            <StatTile label="Déjà investi">
              <Amount value={advice.investedTotal} currencyCode={baseCode} className="text-xl font-semibold" />
            </StatTile>
          </div>

          {advice.verdict !== "SET_UP" && (
            <Card>
              <CardTitle>Chaque mois</CardTitle>
              {advice.monthlySurplus > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted">
                    Il vous reste en moyenne <span className="font-semibold text-foreground">{fmt(advice.monthlySurplus)}</span> par mois
                    après vos dépenses. À faire :
                  </p>
                  <PlanRow label="Mettre de côté (réserve)" value={advice.monthlyToReserve} total={advice.monthlySurplus} fmt={fmt} color="bg-ember" />
                  <PlanRow label="Investir" value={advice.monthlyToInvest} total={advice.monthlySurplus} fmt={fmt} color="bg-success" />
                  <PlanRow label="Libre (plaisir, imprévus)" value={monthlyFree} total={advice.monthlySurplus} fmt={fmt} color="bg-white/40" />
                  {advice.monthsToReserve !== null && advice.monthsToReserve > 0 && (
                    <p className="text-xs text-muted">
                      À ce rythme, votre réserve est complète dans {advice.monthsToReserve} mois.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Rien à mettre de côté pour l&apos;instant : vos revenus moyens ({fmt(money.monthlyIncome)}) ne dépassent pas vos dépenses.
                </p>
              )}
            </Card>
          )}

          {advice.allocation.length > 0 && (
            <Card>
              <CardTitle>Comment répartir {fmt(advice.investableNow)} maintenant</CardTitle>
              <div className="mt-4 space-y-3">
                {advice.allocation.map((a) => (
                  <div key={a.type} className="rounded-3xl bg-tile p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium text-foreground">
                        {INVESTMENT_TYPE_LABELS[a.type]} <span className="text-muted">· {a.percent} %</span>
                      </span>
                      <Amount value={a.amount} currencyCode={baseCode} className="font-semibold" />
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-success" style={{ width: `${a.percent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted">{a.why}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardTitle>Conseils</CardTitle>
            <ul className="mt-4 space-y-3">
              {advice.tips.map((tip) => {
                const { icon: TipIcon, className } = TIP_ICON[tip.tone];
                return (
                  <li key={tip.text} className="flex gap-3 text-sm text-foreground">
                    <TipIcon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
                    <span>{tip.text}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardTitle>Mon profil</CardTitle>
            <div className="mt-4">
              <InvestmentProfileForm
                defaults={{ monthlyLivingMajor: livingInProfileCurrency, currencyCode: profileCurrency as InvestmentRow["currencyCode"], riskProfile: profile }}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>Ajouter un investissement</CardTitle>
            <div className="mt-4">
              <InvestmentForm />
            </div>
          </Card>

          <Card>
            <CardTitle>Mes investissements</CardTitle>
            <div className="mt-4">
              <InvestmentsList investments={investments} currencies={currencies} />
            </div>
          </Card>
        </div>
      </div>

      <p className="text-xs text-muted">
        Ces conseils suivent des règles générales de gestion de l&apos;argent (réserve de sécurité, diversification, régularité). Ce ne
        sont pas des conseils financiers personnalisés : renseignez-vous avant chaque investissement.
      </p>
    </div>
  );
}

function PlanRow({ label, value, total, fmt, color }: { label: string; value: number; total: number; fmt: (n: number) => string; color: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-semibold text-foreground">{fmt(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
