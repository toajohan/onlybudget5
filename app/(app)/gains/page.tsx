import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { GainForm } from "@/components/forms/GainForm";
import { GainsTable } from "@/components/tables/GainsTable";

export default async function GainsPage() {
  const user = await requireUser();
  const isAssociate = user.role === "ASSOCIE";

  const [wallets, chatters, gains, currencies] = await Promise.all([
    prisma.wallet.findMany({ where: { isSource: true, archived: false }, orderBy: { name: "asc" } }),
    isAssociate
      ? prisma.user.findMany({ where: { active: true }, orderBy: [{ role: "desc" }, { name: "asc" }] })
      : Promise.resolve(undefined),
    prisma.gain.findMany({
      where: isAssociate ? undefined : { chatterId: user.id },
      include: { chatter: true, wallet: true, createdBy: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.currency.findMany(),
  ]);

  // Editing must also offer a gain's own wallet even if it is not a direct-gain account any more.
  const usedWalletIds = [...new Set(gains.map((g) => g.walletId))];
  const editWallets = isAssociate
    ? await prisma.wallet.findMany({
        where: { OR: [{ isSource: true, archived: false }, { id: { in: usedWalletIds } }] },
        orderBy: { name: "asc" },
      })
    : wallets;

  const rows = gains.map((g) => ({
    id: g.id,
    date: g.date,
    amountMinor: Number(g.amountMinor),
    grossAmountMinor: g.grossAmountMinor === null ? null : Number(g.grossAmountMinor),
    commissionPercent: g.commissionPercent,
    currencyCode: g.currencyCode,
    chatterId: g.chatterId,
    chatterName: g.chatter.name,
    walletId: g.walletId,
    walletIcon: g.wallet.icon,
    walletLogoUrl: g.wallet.logoUrl,
    walletName: g.wallet.name,
    note: g.note,
    createdByName: g.createdBy.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventes"
        subtitle={isAssociate ? "Enregistrez un gain pour n'importe quel chatteur." : "Enregistrez vos gains du jour."}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardTitle>Nouveau gain</CardTitle>
          <div className="mt-4">
            <GainForm wallets={wallets} chatters={chatters} currentUserId={user.id} />
          </div>
        </Card>

        <Card>
          <CardTitle>{isAssociate ? "Tous les gains" : "Mes gains"}</CardTitle>
          <div className="mt-4">
            <GainsTable
              gains={rows}
              showChatter={isAssociate}
              canManage={isAssociate}
              currencies={currencies}
              wallets={editWallets}
              chatters={chatters}
              currentUserId={user.id}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
