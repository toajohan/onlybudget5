"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { walletRouteSchema, type WalletRouteInput } from "@/lib/validation/settings";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { Wallet } from "@prisma/client";

export type RouteWithFee = {
  id: string;
  fromWalletId: string;
  toWalletId: string;
  feeType: "NONE" | "PERCENT" | "FIXED";
  feePercent: number | null;
  feeFixedMinor: number;
};

export function RouteForm({
  wallets,
  route,
  lockedFromWalletId,
  onSuccess,
}: {
  wallets: Wallet[];
  route?: RouteWithFee;
  /** When set, the source account is fixed (shown read-only) instead of a dropdown — used for "add next step" on an existing chain. */
  lockedFromWalletId?: string;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const fromWalletId = route?.fromWalletId ?? lockedFromWalletId;
  const lockedFromWallet = fromWalletId ? wallets.find((w) => w.id === fromWalletId) : undefined;
  const toOptions = wallets.filter((w) => w.id !== fromWalletId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WalletRouteInput>({
    resolver: zodResolver(walletRouteSchema),
    defaultValues: route
      ? {
          fromWalletId: route.fromWalletId,
          toWalletId: route.toWalletId,
          feeType: route.feeType,
          feePercent: route.feePercent ?? undefined,
          feeFixedMajor: route.feeFixedMinor ? route.feeFixedMinor / 100 : undefined,
        }
      : {
          fromWalletId: fromWalletId ?? wallets[0]?.id ?? "",
          toWalletId: toOptions[0]?.id ?? "",
          feeType: "NONE",
        },
  });
  const feeType = watch("feeType");

  async function onSubmit(data: WalletRouteInput) {
    setServerError(null);
    const res = await fetch("/api/wallet-routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
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
        <Label>Compte source</Label>
        {lockedFromWallet ? (
          <>
            <input type="hidden" {...register("fromWalletId")} value={lockedFromWallet.id} />
            <p className="rounded-2xl bg-tile px-4 py-3 text-sm text-foreground">
              {lockedFromWallet.name}
            </p>
          </>
        ) : (
          <Select {...register("fromWalletId")}>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div>
        <Label>Compte destination</Label>
        <Select {...register("toWalletId")}>
          {toOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
        <FormError message={errors.toWalletId?.message} />
      </div>
      <div>
        <Label>Frais de retrait</Label>
        <Select {...register("feeType")}>
          <option value="NONE">Aucun frais</option>
          <option value="PERCENT">Pourcentage</option>
          <option value="FIXED">Montant fixe</option>
        </Select>
      </div>
      {feeType === "PERCENT" && (
        <div>
          <Label>Pourcentage (%)</Label>
          <Input type="number" step="0.01" min="0" max="100" {...register("feePercent", { valueAsNumber: true })} />
          <FormError message={errors.feePercent?.message} />
        </div>
      )}
      {feeType === "FIXED" && (
        <div>
          <Label>Montant fixe (devise du compte source)</Label>
          <Input type="number" step="0.01" min="0" {...register("feeFixedMajor", { valueAsNumber: true })} />
          <FormError message={errors.feeFixedMajor?.message} />
        </div>
      )}
      {serverError && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{serverError}</p>}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Enregistrer
      </Button>
    </form>
  );
}
