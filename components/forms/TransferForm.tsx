"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import { computeTransfer } from "@/lib/fees";
import { formatMajor, formatMajorParts, toMinorUnits, type CurrencyLike } from "@/lib/currency";
import type { RouteWithFee } from "./RouteForm";
import type { Wallet } from "@prisma/client";

export function TransferForm({
  wallets,
  routes,
  currencies,
}: {
  wallets: Wallet[];
  routes: RouteWithFee[];
  currencies: CurrencyLike[];
}) {
  const router = useRouter();
  const fromOptions = useMemo(() => [...new Set(routes.map((r) => r.fromWalletId))], [routes]);
  const [fromWalletId, setFromWalletId] = useState(fromOptions[0] ?? "");
  const availableRoutes = routes.filter((r) => r.fromWalletId === fromWalletId);
  const [toWalletId, setToWalletId] = useState(availableRoutes[0]?.toWalletId ?? "");
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleFromChange(id: string) {
    setFromWalletId(id);
    const next = routes.find((r) => r.fromWalletId === id);
    setToWalletId(next?.toWalletId ?? "");
  }

  const fromWallet = wallets.find((w) => w.id === fromWalletId);
  const toWallet = wallets.find((w) => w.id === toWalletId);
  const activeRoute = routes.find((r) => r.fromWalletId === fromWalletId && r.toWalletId === toWalletId);
  const amount = Number(amountText);

  const preview =
    activeRoute && fromWallet && toWallet && amount > 0
      ? computeTransfer(activeRoute, Number(toMinorUnits(amount)), fromWallet.currencyCode, toWallet.currencyCode, currencies)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRoute || !fromWallet || !toWallet || !(amount > 0)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWalletId, toWalletId, amountMajor: amount, note }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erreur lors du retrait.");
      return;
    }
    setAmountText("");
    setNote("");
    setSuccess(true);
    router.refresh();
    setTimeout(() => setSuccess(false), 2000);
  }

  if (routes.length === 0) {
    return <p className="text-sm text-muted">Configurez d&apos;abord un chemin de retrait ci-contre.</p>;
  }

  // Currency symbol shown in front of the big amount ("€", "$", "Ar"), like a bank app's transfer screen.
  const parts = fromWallet ? formatMajorParts(0, fromWallet.currencyCode) : null;
  const symbol = parts ? parts.prefix || parts.suffix.trim() : "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Compte source</Label>
        <Select value={fromWalletId} onChange={(e) => handleFromChange(e.target.value)}>
          {fromOptions.map((id) => {
            const w = wallets.find((x) => x.id === id);
            return (
              <option key={id} value={id}>
                {w?.name}
              </option>
            );
          })}
        </Select>
      </div>

      <div>
        <Label>Compte destination</Label>
        <Select value={toWalletId} onChange={(e) => setToWalletId(e.target.value)}>
          {availableRoutes.map((r) => {
            const w = wallets.find((x) => x.id === r.toWalletId);
            return (
              <option key={r.toWalletId} value={r.toWalletId}>
                {w?.name}
              </option>
            );
          })}
        </Select>
      </div>

      <div>
        <Label htmlFor="transfer-amount">Montant à retirer {fromWallet ? `(${fromWallet.currencyCode})` : ""}</Label>
        <div className="flex items-baseline justify-center gap-2 rounded-3xl bg-tile px-5 py-4">
          {symbol && <span className="text-2xl text-white/60">{symbol}</span>}
          <input
            id="transfer-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="w-full min-w-0 bg-transparent text-center text-[44px] leading-tight font-medium tracking-tight text-foreground [appearance:textfield] placeholder:text-white/25 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>

      {preview && fromWallet && toWallet && (
        <div className="space-y-2 rounded-2xl bg-tile p-4 text-sm">
          {preview.exchangeRateUsed !== null && (
            <div className="flex justify-between">
              <span className="text-muted">Taux appliqué</span>
              <span className="font-medium tabular-nums">
                1 {fromWallet.currencyCode} = {formatMajor(preview.exchangeRateUsed, toWallet.currencyCode)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted">Frais</span>
            <Amount value={preview.feeAmountMinor / 100} currencyCode={fromWallet.currencyCode} sign="negative" />
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-foreground">Montant reçu sur {toWallet.name}</span>
            <Amount value={preview.amountReceivedMinor / 100} currencyCode={toWallet.currencyCode} sign="positive" />
          </div>
        </div>
      )}

      <div>
        <Label>Note (optionnel)</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <Button type="submit" className="w-full" loading={submitting} disabled={!activeRoute || !(amount > 0)}>
        {success ? "Retrait effectué ✓" : "Confirmer le retrait"}
      </Button>
    </form>
  );
}
