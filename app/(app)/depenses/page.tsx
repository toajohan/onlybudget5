import { requireAssocie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { ExpensesTable } from "@/components/tables/ExpensesTable";

export default async function DepensesPage() {
  await requireAssocie();

  const [categories, wallets, expenses, currencies] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.wallet.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({
      include: { category: true, wallet: true, createdBy: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.currency.findMany(),
  ]);

  // Editing must also offer an expense's own category/wallet even if it has been archived since.
  const usedCategoryIds = [...new Set(expenses.map((e) => e.categoryId))];
  const usedWalletIds = [...new Set(expenses.map((e) => e.walletId))];
  const [editCategories, editWallets] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { OR: [{ archived: false }, { id: { in: usedCategoryIds } }] }, orderBy: { name: "asc" } }),
    prisma.wallet.findMany({ where: { OR: [{ archived: false }, { id: { in: usedWalletIds } }] }, orderBy: { name: "asc" } }),
  ]);

  const rows = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    amountMinor: Number(e.amountMinor),
    currencyCode: e.currencyCode,
    categoryId: e.categoryId,
    categoryName: e.category.name,
    categoryIcon: e.category.icon,
    categoryLogoUrl: e.category.logoUrl,
    walletId: e.walletId,
    walletName: e.wallet.name,
    note: e.note,
    createdByName: e.createdBy.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dépenses" subtitle="Abonnements, loyer, nourriture, provisions..." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardTitle>Nouvelle dépense</CardTitle>
          <div className="mt-4">
            <ExpenseForm categories={categories} wallets={wallets} />
          </div>
        </Card>

        <Card>
          <CardTitle>Toutes les dépenses</CardTitle>
          <div className="mt-4">
            <ExpensesTable expenses={rows} currencies={currencies} categories={editCategories} wallets={editWallets} />
          </div>
        </Card>
      </div>
    </div>
  );
}
