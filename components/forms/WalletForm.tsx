"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { walletFormSchema, type WalletFormValues } from "@/lib/validation/settings";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { formatMinor } from "@/lib/currency";
import { IconLogoField } from "./IconLogoField";
import type { Currency, User, Wallet } from "@prisma/client";

/** What the account already holds: shown when its currency is changed, since all of it changes currency. */
export type WalletUsage = { gains: number; expenses: number; transfers: number };

type Props = {
  currencies: Currency[];
  associates: User[];
  wallet?: Wallet;
  usage?: WalletUsage;
  onSuccess: () => void;
};

function plural(count: number, word: string) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

/** "14 gains, 2 dépenses et 3 retraits", or null for an account without any operation. */
function describeUsage(usage?: WalletUsage): string | null {
  if (!usage) return null;
  const parts = [
    usage.gains > 0 ? plural(usage.gains, "gain") : null,
    usage.expenses > 0 ? plural(usage.expenses, "dépense") : null,
    usage.transfers > 0 ? plural(usage.transfers, "retrait") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

export function WalletForm({ currencies, associates, wallet, usage, onSuccess }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const isEdit = Boolean(wallet);
  const [icon, setIcon] = useState(wallet?.icon ?? "Wallet");
  const [logoUrl, setLogoUrl] = useState<string | null>(wallet?.logoUrl ?? null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: wallet
      ? {
          name: wallet.name,
          currencyCode: wallet.currencyCode,
          ownerId: wallet.ownerId ?? "",
          isSource: wallet.isSource,
          initialBalanceMajor: 0,
          commissionPercent: wallet.commissionPercent,
        }
      : { name: "", currencyCode: currencies[0]?.code ?? "", ownerId: "", isSource: false, initialBalanceMajor: 0, commissionPercent: 0 },
  });

  const firstFieldError = Object.values(errors)[0]?.message;

  // Changing the currency of an existing account relabels its amounts (no conversion): make that visible before saving.
  const selectedCurrency = useWatch({ control, name: "currencyCode" });
  const currencyChange = wallet && selectedCurrency && selectedCurrency !== wallet.currencyCode ? { from: wallet.currencyCode, to: selectedCurrency } : null;
  const affected = describeUsage(usage);

  async function onSubmit(data: WalletFormValues) {
    setServerError(null);

    if (wallet && data.currencyCode !== wallet.currencyCode) {
      const balance = `${formatMinor(wallet.balanceMinor, wallet.currencyCode)} → ${formatMinor(wallet.balanceMinor, data.currencyCode)}`;
      const kept = affected
        ? `le solde et les opérations de ce compte (${affected}) gardent les mêmes chiffres, mais seront comptés`
        : "le solde garde le même chiffre, mais sera compté";
      const ok = await confirm({
        title: `Changer la devise de « ${wallet.name.trim()} » ?`,
        message: `Aucune conversion : ${kept} en ${data.currencyCode} au lieu de ${wallet.currencyCode}. Solde : ${balance}.`,
        confirmLabel: `Passer en ${data.currencyCode}`,
      });
      if (!ok) return;
    }

    const payload = { ...data, icon, logoUrl, ownerId: data.ownerId || null };
    const url = isEdit ? `/api/wallets/${wallet!.id}` : "/api/wallets";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    toast({
      title: isEdit ? "Compte modifié" : "Compte créé",
      message: currencyChange ? `${data.name.trim()} : ${currencyChange.from} → ${currencyChange.to}` : data.name.trim(),
    });
    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Nom du compte</Label>
        <Input placeholder="Ex: Binance, Mvola de Rakoto..." {...register("name")} />
        <FormError message={errors.name?.message} />
      </div>

      <div>
        <Label>Icône / logo</Label>
        <IconLogoField icon={icon} logoUrl={logoUrl} onIconChange={setIcon} onLogoChange={setLogoUrl} />
      </div>

      <div>
        <Label>Devise</Label>
        <Select {...register("currencyCode")}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
        {currencyChange && wallet ? (
          <div className="mt-2 space-y-2 rounded-2xl bg-tile p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">Solde du compte</span>
              <span className="text-right font-medium tabular-nums">
                {formatMinor(wallet.balanceMinor, currencyChange.from)} → {formatMinor(wallet.balanceMinor, currencyChange.to)}
              </span>
            </div>
            <p className="text-muted">
              Aucune conversion : {affected ? `le solde et les opérations de ce compte (${affected}) gardent` : "le solde garde"} les mêmes chiffres, seule
              la devise change.
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted">
            {isEdit
              ? "Utile pour corriger une devise choisie par erreur : les montants déjà enregistrés gardent les mêmes chiffres (aucune conversion)."
              : "Vous pourrez la corriger plus tard dans Paramètres."}
          </p>
        )}
      </div>

      <div>
        <Label>Propriétaire (optionnel)</Label>
        <Select {...register("ownerId")}>
          <option value="">— Compte de l&apos;agence —</option>
          {associates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      {isEdit ? (
        <input type="hidden" {...register("initialBalanceMajor", { valueAsNumber: true })} />
      ) : (
        <div>
          <Label>Solde de départ (optionnel)</Label>
          <Input type="number" step="0.01" min="0" {...register("initialBalanceMajor", { valueAsNumber: true })} />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" className="h-4 w-4 rounded border-border" {...register("isSource")} />
        Un chatteur peut y enregistrer directement un gain (ex: OnlyChat, PayPal)
      </label>

      <div>
        <Label>Commission de la plateforme (%)</Label>
        <Input type="number" step="0.01" min="0" max="100" placeholder="0" {...register("commissionPercent", { valueAsNumber: true })} />
        <p className="mt-1 text-xs text-muted">
          Ex : 15 pour Wysper. Sur chaque gain saisi sur ce compte, ce pourcentage est retiré automatiquement : seul le reste compte dans vos gains
          et dans le solde du compte. Laissez 0 s&apos;il n&apos;y en a pas.
        </p>
        <FormError message={errors.commissionPercent?.message} />
      </div>

      {(serverError || firstFieldError) && (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError ?? firstFieldError}</p>
      )}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer" : "Créer le compte"}
      </Button>
    </form>
  );
}
