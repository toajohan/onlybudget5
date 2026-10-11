"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { gainCreateSchema, type GainCreateInput } from "@/lib/validation/ledger";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { applyCommission } from "@/lib/commission";
import { formatMajor } from "@/lib/currency";
import { formatNumberFr } from "@/lib/audit";
import { todayInputValue } from "@/lib/date";
import type { User, Wallet } from "@prisma/client";

/** A gain being edited: `amountMajor` is the amount as typed (before commission). */
export type EditableGain = { id: string; chatterId: string; walletId: string; amountMajor: number; date: string; note: string | null };

type Props = {
  wallets: Wallet[];
  chatters?: User[]; // provided only for ASSOCIE — lets them log a gain for anyone
  currentUserId: string;
  gain?: EditableGain;
  onSuccess?: () => void;
};

type SavedGain = { amountMinor: number; grossAmountMinor: number | null; commissionPercent: number | null; currencyCode: string };

export function GainForm({ wallets, chatters, currentUserId, gain, onSuccess }: Props) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(gain);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<GainCreateInput>({
    resolver: zodResolver(gainCreateSchema),
    defaultValues: gain
      ? { chatterId: gain.chatterId, walletId: gain.walletId, amountMajor: gain.amountMajor, date: gain.date, note: gain.note ?? "" }
      : { chatterId: currentUserId, walletId: wallets[0]?.id ?? "", amountMajor: undefined, date: todayInputValue(), note: "" },
  });

  // Live preview of the platform's commission (15 % on Wysper): shown before saving so nobody is surprised.
  const [walletId, amountMajor] = useWatch({ control, name: ["walletId", "amountMajor"] });
  const selected = wallets.find((w) => w.id === walletId);
  const rate = selected?.commissionPercent ?? 0;
  const typed = Number(amountMajor);
  const split = rate > 0 && Number.isFinite(typed) && typed > 0 ? applyCommission(Math.round(typed * 100), rate) : null;
  const money = (minor: number, code = selected?.currencyCode ?? "USD") => formatMajor(minor / 100, code);

  async function onSubmit(data: GainCreateInput) {
    setServerError(null);
    setSuccess(false);
    const res = await fetch(isEdit ? `/api/gains/${gain!.id}` : "/api/gains", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; gain?: SavedGain };
    if (!res.ok) {
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    const saved = body.gain;
    const walletName = wallets.find((w) => w.id === data.walletId)?.name ?? "";
    const withCommission = saved && saved.grossAmountMinor !== null && (saved.commissionPercent ?? 0) > 0;
    toast({
      title: isEdit ? "Gain modifié" : "Gain ajouté",
      message: saved
        ? `${money(saved.amountMinor, saved.currencyCode)}${walletName ? ` sur ${walletName}` : ""}` +
          (withCommission
            ? ` (${money(saved.grossAmountMinor!, saved.currencyCode)} − ${formatNumberFr(saved.commissionPercent!)} % de commission)`
            : "")
        : "Enregistré.",
    });

    router.refresh();
    if (isEdit) {
      onSuccess?.();
      return;
    }
    reset({ chatterId: data.chatterId, walletId: data.walletId, amountMajor: undefined, date: todayInputValue(), note: "" });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  }

  if (wallets.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucun compte n&apos;accepte de gains pour l&apos;instant. Demandez à un associé d&apos;en configurer un dans
        Paramètres.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {chatters && (
        <div>
          <Label>Pour qui</Label>
          <Select {...register("chatterId")}>
            {chatters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === currentUserId ? `${c.name} (moi)` : c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label>Compte / plateforme</Label>
        <Select {...register("walletId")}>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.currencyCode})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <div>
          <Label>Montant</Label>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register("amountMajor", { valueAsNumber: true })} />
          <FormError message={errors.amountMajor?.message} />
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" {...register("date")} />
        </div>
      </div>

      {selected && rate > 0 && (
        <div className="space-y-2 rounded-2xl bg-tile p-4 text-sm">
          {split ? (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Montant saisi</span>
                <span className="font-medium tabular-nums">{money(split.grossMinor)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">
                  Commission {selected.name} ({formatNumberFr(rate)} %)
                </span>
                <span className="font-medium text-danger tabular-nums">−{money(split.commissionMinor)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                <span className="font-semibold text-foreground">Votre gain sur {selected.name}</span>
                <span className="font-semibold text-success tabular-nums">{money(split.netMinor)}</span>
              </div>
            </>
          ) : (
            <p className="text-muted">
              {selected.name} garde {formatNumberFr(rate)} % de chaque gain : ce pourcentage est retiré automatiquement du montant saisi.
            </p>
          )}
        </div>
      )}

      <div>
        <Label>Note (optionnel)</Label>
        <Textarea rows={2} placeholder="Ex: pourboire, abonnement..." {...register("note")} />
      </div>

      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer les modifications" : success ? "Gain ajouté ✓" : "Ajouter le gain"}
      </Button>
    </form>
  );
}
