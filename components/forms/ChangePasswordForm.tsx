"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/auth";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";

export function ChangePasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(data: ChangePasswordInput) {
    setServerError(null);
    setSuccess(false);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Erreur.");
      return;
    }
    reset();
    setSuccess(true);
    router.refresh();
    setTimeout(() => setSuccess(false), 2500);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
      <div>
        <Label>Mot de passe actuel</Label>
        <Input type="password" {...register("currentPassword")} />
        <FormError message={errors.currentPassword?.message} />
      </div>
      <div>
        <Label>Nouveau mot de passe</Label>
        <Input type="password" {...register("newPassword")} />
        <FormError message={errors.newPassword?.message} />
      </div>
      <div>
        <Label>Confirmer le nouveau mot de passe</Label>
        <Input type="password" {...register("confirmPassword")} />
        <FormError message={errors.confirmPassword?.message} />
      </div>
      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}
      <Button type="submit" loading={isSubmitting}>
        {success ? "Mot de passe changé ✓" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
