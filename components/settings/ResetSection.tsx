"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { AlertTriangle } from "lucide-react";

export type ResetCounts = { gains: number; expenses: number; transfers: number };

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** "Zone de danger": wipes every gain/expense/transfer and resets balances to 0 — a fresh start once figures are trusted. */
export function ResetSection({ counts }: { counts: ResetCounts }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const empty = counts.gains === 0 && counts.expenses === 0 && counts.transfers === 0;
  const summary = `${plural(counts.gains, "gain")}, ${plural(counts.expenses, "dépense")} et ${plural(counts.transfers, "retrait")}`;

  async function handleReset() {
    const ok = await confirm({
      title: "Réinitialiser toutes les données financières ?",
      message: (
        <>
          Action définitive : {summary} seront supprimés, et le solde de chaque compte reviendra à 0 (pas à son solde
          de départ). Les comptes, devises, taux, commissions, chemins de retrait, catégories et membres sont
          conservés.
        </>
      ),
      confirmLabel: "Tout réinitialiser",
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    const res = await fetch("/api/reset", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast({ tone: "error", message: body.error ?? "Erreur lors de la réinitialisation." });
      return;
    }
    toast({ title: "Données réinitialisées", message: `${summary} supprimés, soldes remis à 0.` });
    router.refresh();
  }

  return (
    <Card className="ring-1 ring-danger/30">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle>Zone de danger</CardTitle>
          <p className="mt-1 text-xs text-muted">
            Supprime définitivement tous les gains, dépenses et retraits, et remet chaque solde à 0. Les comptes,
            devises, catégories et membres restent intacts. Utile pour repartir de zéro une fois les chiffres
            vérifiés.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">Actuellement : {summary}.</p>
        <Button variant="danger" size="sm" className="ml-auto" onClick={handleReset} loading={busy} disabled={empty}>
          Tout réinitialiser
        </Button>
      </div>
    </Card>
  );
}
