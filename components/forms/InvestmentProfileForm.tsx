"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentProfileSchema, type InvestmentProfileInput } from "@/lib/validation/investment";
import { RISK_PROFILES, RISK_PROFILE_LABELS, PROFILE_RULES, type RiskProfile } from "@/lib/investment";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/feedback/FeedbackProvider";

const PROFILE_HINTS: Record<RiskProfile, string> = {
  PRUDENT: "Je ne veux pas voir mon argent baisser.",
  EQUILIBRE: "J'accepte des baisses passagères pour gagner plus.",
  DYNAMIQUE: "Je vise le maximum, même avec de grosses baisses.",
};

export function InvestmentProfileForm({ defaults }: { defaults: InvestmentProfileInput }) {
  const router = useRouter();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InvestmentProfileInput>({ resolver: zodResolver(investmentProfileSchema), defaultValues: defaults });
  const profile = watch("riskProfile");

  async function onSubmit(data: InvestmentProfileInput) {
    setServerError(null);
    const res = await fetch("/api/investment-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    toast({ title: "Profil enregistré", message: "Vos conseils sont mis à jour." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label>Mes dépenses perso par mois</Label>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register("monthlyLivingMajor", { valueAsNumber: true })} />
        </div>
        <div>
          <Label>Devise</Label>
          <Select {...register("currencyCode")}>
            <option value="USD">$</option>
            <option value="EUR">€</option>
            <option value="MGA">Ar</option>
          </Select>
        </div>
      </div>
      <FormError message={errors.monthlyLivingMajor?.message} />
      <p className="-mt-2 text-xs text-muted">Loyer, nourriture, transport, famille... tout ce que vous dépensez pour vivre.</p>

      <div>
        <Label>Mon profil</Label>
        <SegmentedControl
          label="Profil de risque"
          items={RISK_PROFILES.map((p) => ({ value: p, label: RISK_PROFILE_LABELS[p] }))}
          value={profile}
          onChange={(p) => setValue("riskProfile", p, { shouldDirty: true })}
          className="flex w-full [&>button]:flex-1 [&>button]:px-2"
        />
        <p className="mt-2 text-xs text-muted">
          {PROFILE_HINTS[profile]} Réserve conseillée : {PROFILE_RULES[profile].reserveMonths} mois de dépenses.
        </p>
      </div>

      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Enregistrer mon profil
      </Button>
    </form>
  );
}
