"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { investmentSchema, type InvestmentInput } from "@/lib/validation/investment";
import { INVESTMENT_TYPES, INVESTMENT_TYPE_LABELS } from "@/lib/investment";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { formatMajor } from "@/lib/currency";
import { todayInputValue } from "@/lib/date";

export type EditableInvestment = InvestmentInput & { id: string };

export function InvestmentForm({ investment, onSuccess }: { investment?: EditableInvestment; onSuccess?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(investment);
  const [serverError, setServerError] = useState<string | null>(null);

  const empty: InvestmentInput = {
    name: "",
    type: "ETF",
    amountMajor: undefined as unknown as number,
    currentValueMajor: null,
    currencyCode: "USD",
    date: todayInputValue(),
    note: "",
  };
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvestmentInput>({ resolver: zodResolver(investmentSchema), defaultValues: investment ?? empty });

  async function onSubmit(data: InvestmentInput) {
    setServerError(null);
    const res = await fetch(isEdit ? `/api/investments/${investment!.id}` : "/api/investments", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    toast({
      title: isEdit ? "Investissement modifié" : "Investissement ajouté",
      message: `${data.name} · ${formatMajor(data.amountMajor, data.currencyCode)}`,
    });
    router.refresh();
    if (isEdit) {
      onSuccess?.();
      return;
    }
    reset({ ...empty, type: data.type, currencyCode: data.currencyCode });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Nom</Label>
        <Input placeholder="Ex: Bitcoin, ETF S&P 500, terrain à Ivato..." {...register("name")} />
        <FormError message={errors.name?.message} />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label>Type</Label>
          <Select {...register("type")}>
            {INVESTMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {INVESTMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
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

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <div>
          <Label>Montant investi</Label>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register("amountMajor", { valueAsNumber: true })} />
          <FormError message={errors.amountMajor?.message} />
        </div>
        <div>
          <Label>Valeur actuelle (optionnel)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Si elle a changé"
            {...register("currentValueMajor", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
          />
          <FormError message={errors.currentValueMajor?.message} />
        </div>
      </div>

      <div>
        <Label>Date</Label>
        <Input type="date" {...register("date")} />
      </div>

      <div>
        <Label>Note (optionnel)</Label>
        <Textarea rows={2} placeholder="Ex: acheté sur Binance" {...register("note")} />
      </div>

      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer les modifications" : "Ajouter l'investissement"}
      </Button>
    </form>
  );
}
