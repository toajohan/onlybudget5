import { requireAssocie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CurrenciesSection } from "@/components/settings/CurrenciesSection";
import { WalletsSection } from "@/components/settings/WalletsSection";
import { CategoriesSection } from "@/components/settings/CategoriesSection";
import { ResetSection } from "@/components/settings/ResetSection";
import { OnlyChatSection } from "@/components/settings/OnlyChatSection";

export default async function ParametresPage() {
  await requireAssocie();

  const [currencies, wallets, categories, allAssociates, gainsCount, expensesCount, transfersCount, onlyChatSettings] = await Promise.all([
    prisma.currency.findMany({ orderBy: { code: "asc" } }),
    prisma.wallet.findMany({
      orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { gains: true, expenses: true, transfersFrom: true, transfersTo: true } } },
    }),
    prisma.expenseCategory.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] }),
    prisma.user.findMany({ where: { role: "ASSOCIE" }, orderBy: { name: "asc" } }),
    prisma.gain.count(),
    prisma.expense.count(),
    prisma.transfer.count(),
    prisma.appSetting.findMany({ where: { key: { in: ["onlychat.url", "onlychat.apiKey"] } }, select: { key: true, value: true } }),
  ]);
  const onlyChatUrl = onlyChatSettings.find((s) => s.key === "onlychat.url")?.value ?? null;
  const onlyChatHasKey = onlyChatSettings.some((s) => s.key === "onlychat.apiKey");

  // Deactivated associates are not offered as owners (unless they already own an account, so saving never clears it).
  const associates = allAssociates.filter((a) => a.active || wallets.some((w) => w.ownerId === a.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" subtitle="Devises, comptes, catégories de dépenses et OnlyChat." />
      <CurrenciesSection currencies={currencies} />
      <WalletsSection wallets={wallets} currencies={currencies} associates={associates} />
      <CategoriesSection categories={categories} />
      <OnlyChatSection url={onlyChatUrl} hasKey={onlyChatHasKey} />
      <ResetSection counts={{ gains: gainsCount, expenses: expensesCount, transfers: transfersCount }} />
    </div>
  );
}
