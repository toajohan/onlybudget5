"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Amount } from "@/components/ui/Amount";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { Modal } from "@/components/ui/Modal";
import { TxRow } from "@/components/ui/TxRow";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { formatDate } from "@/lib/date";
import { equivalentLabel, formatMajor, toMajorUnits, type CurrencyLike } from "@/lib/currency";
import { Pencil, Trash2, Receipt } from "lucide-react";
import type { ExpenseCategory, Wallet } from "@prisma/client";

type ExpenseRow = {
  id: string;
  date: Date;
  amountMinor: number;
  currencyCode: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryLogoUrl: string | null;
  walletId: string;
  walletName: string;
  note: string | null;
  createdByName: string;
};

const ROW_BUTTON = "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

export function ExpensesTable({
  expenses,
  currencies,
  categories,
  wallets,
}: {
  expenses: ExpenseRow[];
  currencies: CurrencyLike[];
  /** Categories and wallets offered when editing (the expense's own ones are always among them). */
  categories: ExpenseCategory[];
  wallets: Wallet[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  async function handleDelete(expense: ExpenseRow) {
    const ok = await confirm({
      title: "Supprimer cette dépense ?",
      message: `${formatMajor(toMajorUnits(expense.amountMinor), expense.currencyCode)} · ${expense.categoryName} · ${expense.walletName}. Le solde du compte, les totaux et le bénéfice net seront recalculés.`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de supprimer cette dépense." });
      return;
    }
    toast({ title: "Dépense supprimée", message: `${formatMajor(toMajorUnits(expense.amountMinor), expense.currencyCode)} · ${expense.categoryName}` });
    router.refresh();
  }

  if (expenses.length === 0) {
    return <EmptyState icon={Receipt} title="Aucune dépense enregistrée" description="Ajoutez la première dépense avec le formulaire." />;
  }

  return (
    <>
      <div className="space-y-2">
        {expenses.map((expense) => {
          const value = toMajorUnits(expense.amountMinor);
          return (
            <TxRow
              wrapTitle
              key={expense.id}
              leading={<LogoCircle icon={expense.categoryIcon} logoUrl={expense.categoryLogoUrl} />}
              title={expense.categoryName}
              subtitle={[`payé depuis ${expense.walletName}`, formatDate(expense.date), `ajouté par ${expense.createdByName}`].join(" · ")}
              amount={<Amount value={value} currencyCode={expense.currencyCode} sign="negative" />}
              eq={equivalentLabel(value, expense.currencyCode, currencies)}
              action={
                <div className="flex shrink-0">
                  <button onClick={() => setEditing(expense)} className={`${ROW_BUTTON} hover:text-foreground`} title="Modifier" aria-label="Modifier cette dépense">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(expense)} className={`${ROW_BUTTON} hover:text-danger`} title="Supprimer" aria-label="Supprimer cette dépense">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              }
            />
          );
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier la dépense">
        {editing && (
          <ExpenseForm
            key={editing.id}
            categories={categories}
            wallets={wallets}
            expense={{
              id: editing.id,
              categoryId: editing.categoryId,
              walletId: editing.walletId,
              amountMajor: toMajorUnits(editing.amountMinor),
              date: editing.date.toISOString().slice(0, 10),
              note: editing.note,
            }}
            onSuccess={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
