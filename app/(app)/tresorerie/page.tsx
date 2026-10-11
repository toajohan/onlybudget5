import { requireAssocie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Amount } from "@/components/ui/Amount";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { PageHeader } from "@/components/ui/PageHeader";
import { TransferForm } from "@/components/forms/TransferForm";
import { RoutesSection } from "@/components/treasury/RoutesSection";
import { toMajorUnits, convertMinor, convertAmount, formatMajor } from "@/lib/currency";

// Currency used for aggregate figures. Independent from the database's technical
// rate-anchor currency (Currency.isBase) — see lib/currency.ts.
const REPORTING_CODE = "USD";

export default async function TresoreriePage() {
  await requireAssocie();

  const [wallets, routes, currencies, transfers] = await Promise.all([
    prisma.wallet.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.walletRoute.findMany({ where: { archived: false }, orderBy: { createdAt: "asc" } }),
    prisma.currency.findMany(),
    prisma.transfer.findMany({ select: { feeAmountMinor: true, fromCurrencyCode: true } }),
  ]);

  const baseCode = REPORTING_CODE;
  const totalFeesBase = toMajorUnits(
    transfers.reduce((sum, t) => sum + convertMinor(t.feeAmountMinor, t.fromCurrencyCode, baseCode, currencies), 0)
  );

  const serializedRoutes = routes.map((r) => ({
    id: r.id,
    fromWalletId: r.fromWalletId,
    toWalletId: r.toWalletId,
    feeType: r.feeType,
    feePercent: r.feePercent,
    feeFixedMinor: Number(r.feeFixedMinor ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Trésorerie" subtitle="Soldes des comptes, retraits entre comptes et frais." />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
        {wallets.map((w) => (
          <div key={w.id} className="flex min-h-[136px] flex-col rounded-3xl bg-tile p-4">
            <LogoCircle icon={w.icon} logoUrl={w.logoUrl} size={40} />
            <div className="mt-auto pt-4">
              <p className="truncate text-[13px] text-muted">{w.name}</p>
              <Amount value={toMajorUnits(w.balanceMinor)} currencyCode={w.currencyCode} className="block text-[17px] font-semibold tracking-tight" />
              <p className="min-h-[17px] text-xs text-muted">
                {w.currencyCode !== REPORTING_CODE && (
                  <>
                    ≈{" "}
                    <Amount
                      value={convertAmount(toMajorUnits(w.balanceMinor), w.currencyCode, REPORTING_CODE, currencies)}
                      currencyCode={REPORTING_CODE}
                      className="text-muted"
                    />
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      <section aria-label="Total des frais payés" className="hero-card relative flex min-h-[104px] flex-col justify-between gap-4 overflow-hidden rounded-3xl p-5 text-white">
        <span className="relative text-sm">Total des frais payés (retraits)</span>
        <span className="relative text-[32px] leading-[1.1] font-medium tracking-tight">
          {totalFeesBase > 0 ? "−" : ""}
          {formatMajor(totalFeesBase, baseCode)}
        </span>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardTitle>Nouveau retrait / transfert</CardTitle>
          <div className="mt-4">
            <TransferForm wallets={wallets} routes={serializedRoutes} currencies={currencies} />
          </div>
        </Card>
        <RoutesSection wallets={wallets} routes={serializedRoutes} />
      </div>
    </div>
  );
}
