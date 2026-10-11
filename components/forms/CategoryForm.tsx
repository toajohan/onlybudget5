"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { categoryFormSchema, type CategoryFormValues } from "@/lib/validation/settings";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { IconLogoField } from "./IconLogoField";
import type { ExpenseCategory } from "@prisma/client";

export function CategoryForm({ category, onSuccess }: { category?: ExpenseCategory; onSuccess: () => void }) {
  const router = useRouter();
  const isEdit = Boolean(category);
  const [icon, setIcon] = useState(category?.icon ?? "MoreHorizontal");
  const [logoUrl, setLogoUrl] = useState<string | null>(category?.logoUrl ?? null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? "" },
  });

  async function onSubmit(data: CategoryFormValues) {
    setServerError(null);
    const payload = { ...data, icon, logoUrl };
    const url = isEdit ? `/api/expense-categories/${category!.id}` : "/api/expense-categories";
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
    router.refresh();
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Nom de la catégorie</Label>
        <Input placeholder="Ex: Loyer, Nourriture..." {...register("name")} />
        <FormError message={errors.name?.message} />
      </div>
      <div>
        <Label>Icône / logo</Label>
        <IconLogoField icon={icon} logoUrl={logoUrl} onIconChange={setIcon} onLogoChange={setLogoUrl} />
      </div>
      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}
      {!serverError && errors.name && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{errors.name.message}</p>}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isEdit ? "Enregistrer" : "Créer la catégorie"}
      </Button>
    </form>
  );
}
