"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { formatNumberFr } from "@/lib/audit";
import { WalletForm } from "@/components/forms/WalletForm";
import { Amount } from "@/components/ui/Amount";
import { toMajorUnits } from "@/lib/currency";
import { Plus, Pencil, ArchiveRestore, Archive } from "lucide-react";
import type { Currency, User, Wallet } from "@prisma/client";

const ICON_BUTTON =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10";

/** A wallet with how many operations point at it (needed to warn about them when its currency changes). */
export type WalletWithCounts = Wallet & {
  _count: { gains: number; expenses: number; transfersFrom: number; transfersTo: number };
};

export function WalletsSection({
  wallets,
  currencies,
  associates,
}: {
  wallets: WalletWithCounts[];
  currencies: Currency[];
  associates: User[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletWithCounts | undefined>(undefined);

  function openCreate() {
    setEditingWallet(undefined);
    setModalOpen(true);
  }
  function openEdit(wallet: WalletWithCounts) {
    setEditingWallet(wallet);
    setModalOpen(true);
  }

  async function toggleArchive(wallet: WalletWithCounts) {
    if (!wallet.archived) {
      const ok = await confirm({
        title: `Archiver « ${wallet.name} » ?`,
        message: "Le compte n'apparaîtra plus dans les formulaires. Son historique est conservé et vous pourrez le réactiver à tout moment.",
        confirmLabel: "Archiver",
        tone: "danger",
      });
      if (!ok) return;
    }
    const res = await fetch(`/api/wallets/${wallet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !wallet.archived }),
    });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de modifier ce compte." });
      return;
    }
    toast({ title: wallet.archived ? "Compte réactivé" : "Compte archivé", message: wallet.name });
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Comptes / maisons d&apos;argent</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Ajouter un compte
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Créez ici chaque compte où l&apos;argent transite (OnlyChat, PayPal, Binance, Banque, Mvola...). Configurez les
        chemins de retrait et les frais entre comptes dans la page Trésorerie.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`flex items-start gap-3 rounded-2xl bg-tile p-4 ${wallet.archived ? "opacity-50" : ""}`}
          >
            <LogoCircle icon={wallet.icon} logoUrl={wallet.logoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{wallet.name}</p>
                {wallet.isSource && (
                  <Badge variant="primary" className="shrink-0">
                    Source
                  </Badge>
                )}
                {wallet.commissionPercent > 0 && (
                  <Badge className="shrink-0">Commission {formatNumberFr(wallet.commissionPercent)} %</Badge>
                )}
              </div>
              <p className="text-xs text-muted">{wallet.currencyCode}</p>
              <Amount value={toMajorUnits(wallet.balanceMinor)} currencyCode={wallet.currencyCode} className="text-sm" />
            </div>
            <div className="flex shrink-0 flex-col">
              <button onClick={() => openEdit(wallet)} className={`${ICON_BUTTON} hover:text-foreground`} title="Modifier" aria-label={`Modifier ${wallet.name}`}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => toggleArchive(wallet)}
                className={`${ICON_BUTTON} hover:text-danger`}
                title={wallet.archived ? "Réactiver" : "Archiver"}
                aria-label={`${wallet.archived ? "Réactiver" : "Archiver"} ${wallet.name}`}
              >
                {wallet.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingWallet ? "Modifier le compte" : "Nouveau compte"}>
        <WalletForm
          key={editingWallet?.id ?? "new"}
          currencies={currencies}
          associates={associates}
          wallet={editingWallet}
          usage={
            editingWallet && {
              gains: editingWallet._count.gains,
              expenses: editingWallet._count.expenses,
              transfers: editingWallet._count.transfersFrom + editingWallet._count.transfersTo,
            }
          }
          onSuccess={() => setModalOpen(false)}
        />
      </Modal>
    </Card>
  );
}
