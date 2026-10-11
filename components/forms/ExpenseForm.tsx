"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseCreateSchema, type ExpenseCreateInput } from "@/lib/validation/ledger";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { formatMajor, toMajorUnits } from "@/lib/currency";
import { todayInputValue } from "@/lib/date";
import type { ExpenseCategory, Wallet } from "@prisma/client";

/** An expense being edited. */
export type EditableExpense = { id: string; categoryId: string; walletId: string; amountMajor: number; date: string; note: string | null };

type SavedExpense = { amountMinor: number; currencyCode: string };

export function ExpenseForm({
  categories,
  wallets,
  expense,
  onSuccess,
}: {
  categories: ExpenseCategory[];
  wallets: Wallet[];
  expense?: EditableExpense;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = Boolean(expense);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseCreateInput>({
    resolver: zodResolver(expenseCreateSchema),
    defaultValues: expense
      ? { categoryId: expense.categoryId, walletId: expense.walletId, amountMajor: expense.amountMajor, date: expense.date, note: expense.note ?? "" }
      : { categoryId: categories[0]?.id ?? "", walletId: wallets[0]?.id ?? "", amountMajor: undefined, date: todayInputValue(), note: "" },
  });

  async function onSubmit(data: ExpenseCreateInput) {
    setServerError(null);
    setSuccess(false);
    const res = await fetch(isEdit ? `/api/expenses/${expense!.id}` : "/api/expenses", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string; expense?: SavedExpense };
    if (!res.ok) {
      setServerError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }

    const categoryName = categories.find((c) => c.id === data.categoryId)?.name ?? "";
    toast({
      title: isEdit ? "Dépense modifiée" : "Dépense ajoutée",
      message: body.expense
        ? `${formatMajor(toMajorUnits(body.expense.amountMinor), body.expense.currencyCode)}${categoryName ? ` · ${categoryName}` : ""}`
        : "Enregistré.",
    });

    router.refresh();
    if (isEdit) {
      onSuccess?.();
      return;
    }
    reset({ categoryId: data.categoryId, walletId: data.walletId, amountMajor: undefined, date: todayInputValue(), note: "" });
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  }

  if (categories.length === 0 || wallets.length === 0) {
    return <p className="text-sm text-muted">Créez d&apos;abord une catégorie et un compte dans Paramètres.</p>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Catégorie</Label>
        <Select {...register("categoryId")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Payé depuis</Label>
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

      <div>
        <Label>Note (optionnel)</Label>
        <Textarea rows={2} placeholder="Ex: facture EDF de septembre..." {...register("note")} />
      </div>

      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer les modifications" : success ? "Dépense ajoutée ✓" : "Ajouter la dépense"}
      </Button>
    </form>
  );
}
