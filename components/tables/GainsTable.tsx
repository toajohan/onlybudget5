"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Amount } from "@/components/ui/Amount";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { Modal } from "@/components/ui/Modal";
import { TxRow } from "@/components/ui/TxRow";
import { GainForm } from "@/components/forms/GainForm";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { formatDate } from "@/lib/date";
import { equivalentLabel, formatMajor, toMajorUnits, type CurrencyLike } from "@/lib/currency";
import { formatNumberFr } from "@/lib/audit";
import { Pencil, Trash2, TrendingUp } from "lucide-react";
import type { User, Wallet } from "@prisma/client";

type GainRow = {
  id: string;
  date: Date;
  /** Net of the wallet's commission: what counts. */
  amountMinor: number;
  /** As typed, before the commission (null for gains recorded before commissions existed). */
  grossAmountMinor: number | null;
  commissionPercent: number | null;
  currencyCode: string;
  chatterId: string;
  chatterName: string;
  walletId: string;
  walletIcon: string | null;
  walletLogoUrl: string | null;
  walletName: string;
  note: string | null;
  createdByName: string;
};

const ROW_BUTTON = "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

export function GainsTable({
  gains,
  showChatter,
  canManage,
  currencies,
  wallets,
  chatters,
  currentUserId,
}: {
  gains: GainRow[];
  showChatter: boolean;
  /** Associates can edit and delete any gain. */
  canManage: boolean;
  currencies: CurrencyLike[];
  /** Wallets offered when editing (the gain's own wallet is always among them). */
  wallets: Wallet[];
  chatters?: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<GainRow | null>(null);

  async function handleDelete(gain: GainRow) {
    const ok = await confirm({
      title: "Supprimer ce gain ?",
      message: `${formatMajor(toMajorUnits(gain.amountMinor), gain.currencyCode)} · ${gain.walletName} · ${gain.chatterName}. Le solde du compte, les totaux et le bénéfice net seront recalculés.`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/gains/${gain.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de supprimer ce gain." });
      return;
    }
    toast({ title: "Gain supprimé", message: `${formatMajor(toMajorUnits(gain.amountMinor), gain.currencyCode)} · ${gain.walletName}` });
    router.refresh();
  }

  if (gains.length === 0) {
    return <EmptyState icon={TrendingUp} title="Aucun gain enregistré" description="Ajoutez le premier gain avec le formulaire." />;
  }

  return (
    <>
      <div className="space-y-2">
        {gains.map((gain) => {
          const value = toMajorUnits(gain.amountMinor);
          const withCommission = gain.grossAmountMinor !== null && (gain.commissionPercent ?? 0) > 0;
          return (
            <TxRow
              wrapTitle
              key={gain.id}
              leading={<LogoCircle icon={gain.walletIcon} logoUrl={gain.walletLogoUrl} />}
              title={gain.walletName}
              subtitle={[
                showChatter ? gain.chatterName : null,
                formatDate(gain.date),
                withCommission
                  ? `${formatMajor(toMajorUnits(gain.grossAmountMinor!), gain.currencyCode)} − ${formatNumberFr(gain.commissionPercent!)} % commission`
                  : null,
                gain.createdByName !== gain.chatterName ? `ajouté par ${gain.createdByName}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              amount={<Amount value={value} currencyCode={gain.currencyCode} sign="positive" />}
              eq={equivalentLabel(value, gain.currencyCode, currencies)}
              action={
                canManage && (
                  <div className="flex shrink-0">
                    <button onClick={() => setEditing(gain)} className={`${ROW_BUTTON} hover:text-foreground`} title="Modifier" aria-label="Modifier ce gain">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(gain)} className={`${ROW_BUTTON} hover:text-danger`} title="Supprimer" aria-label="Supprimer ce gain">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              }
            />
          );
        })}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le gain">
        {editing && (
          <GainForm
            key={editing.id}
            wallets={wallets}
            chatters={chatters}
            currentUserId={currentUserId}
            gain={{
              id: editing.id,
              chatterId: editing.chatterId,
              walletId: editing.walletId,
              amountMajor: toMajorUnits(editing.grossAmountMinor ?? editing.amountMinor),
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
