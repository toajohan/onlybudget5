"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bitcoin, Briefcase, Building2, LineChart, Package, Pencil, PiggyBank, Sprout, Trash2, TrendingUp, type LucideIcon } from "lucide-react";
import { Amount } from "@/components/ui/Amount";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { TxRow } from "@/components/ui/TxRow";
import { InvestmentForm, type EditableInvestment } from "@/components/forms/InvestmentForm";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { INVESTMENT_TYPE_LABELS, type InvestmentType } from "@/lib/investment";
import { equivalentLabel, formatMajor, type CurrencyLike } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/cn";

export type InvestmentRow = EditableInvestment & { type: InvestmentType };

const TYPE_ICONS: Record<InvestmentType, LucideIcon> = {
  EPARGNE: PiggyBank,
  ETF: LineChart,
  ACTIONS: TrendingUp,
  CRYPTO: Bitcoin,
  IMMOBILIER: Building2,
  BUSINESS: Briefcase,
  AUTRE: Package,
};

const ROW_BUTTON = "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

export function InvestmentsList({ investments, currencies }: { investments: InvestmentRow[]; currencies: CurrencyLike[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<InvestmentRow | null>(null);

  async function handleDelete(investment: InvestmentRow) {
    const ok = await confirm({
      title: "Supprimer cet investissement ?",
      message: `${investment.name} · ${formatMajor(investment.amountMajor, investment.currencyCode)}. Il ne sera plus compté dans vos conseils.`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/investments/${investment.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de supprimer cet investissement." });
      return;
    }
    toast({ title: "Investissement supprimé", message: investment.name });
    router.refresh();
  }

  if (investments.length === 0) {
    return (
      <EmptyState
        icon={Sprout}
        title="Aucun investissement pour l'instant"
        description="Ajoutez ce que vous avez déjà investi : les conseils vérifieront que c'est bien réparti."
      />
    );
  }

  return (
    <>
      <div className="space-y-2">
        {investments.map((inv) => {
          const Icon = TYPE_ICONS[inv.type];
          const value = inv.currentValueMajor ?? inv.amountMajor;
          const change = inv.currentValueMajor == null ? null : ((inv.currentValueMajor - inv.amountMajor) / inv.amountMajor) * 100;
          return (
            <TxRow
              key={inv.id}
              leading={
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black">
                  <Icon className="h-5 w-5" />
                </span>
              }
              title={inv.name}
              subtitle={[INVESTMENT_TYPE_LABELS[inv.type], formatDate(new Date(inv.date)), inv.note].filter(Boolean).join(" · ")}
              amount={<Amount value={value} currencyCode={inv.currencyCode} />}
              eq={
                change === null ? (
                  equivalentLabel(value, inv.currencyCode, currencies)
                ) : (
                  <span className={cn(change >= 0 ? "text-success" : "text-danger")}>
                    {change >= 0 ? "+" : ""}
                    {change.toFixed(1).replace(".", ",")} %
                  </span>
                )
              }
              action={
                <div className="flex shrink-0">
                  <button onClick={() => setEditing(inv)} className={`${ROW_BUTTON} hover:text-foreground`} title="Modifier" aria-label="Modifier cet investissement">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(inv)} className={`${ROW_BUTTON} hover:text-danger`} title="Supprimer" aria-label="Supprimer cet investissement">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              }
            />
          );
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier l'investissement">
        {editing && <InvestmentForm key={editing.id} investment={editing} onSuccess={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
