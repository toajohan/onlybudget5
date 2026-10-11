"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { FormError } from "@/components/ui/FormError";
import { Lock, Mail, Wallet } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServerError(body.error ?? "Connexion impossible.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="app-glow flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-9 flex flex-col items-center gap-2.5 text-center">
          <div className="ember-gradient mb-1.5 flex h-[72px] w-[72px] items-center justify-center rounded-[22px] text-white">
            <Wallet className="h-9 w-9" strokeWidth={1.6} />
          </div>
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-foreground">OnlyBudget</h1>
          <p className="text-[15px] text-white/80">Suivi des ventes et de la trésorerie</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="vous@exemple.com"
                className="h-14 rounded-[20px] pl-12"
                {...register("email")}
              />
            </div>
            <FormError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-14 rounded-[20px] pl-12"
                {...register("password")}
              />
            </div>
            <FormError message={errors.password?.message} />
          </div>
          {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}
          <Button type="submit" className="mt-2 h-14 w-full text-base" loading={isSubmitting}>
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
