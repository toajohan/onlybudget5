"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { convertAmount, formatMajor } from "@/lib/currency";
import type { Currency } from "@prisma/client";

export function CurrenciesSection({ currencies }: { currencies: Currency[] }) {
  const eur = currencies.find((c) => c.code === "EUR");
  const usd = currencies.find((c) => c.code === "USD");

  return (
    <Card>
      <CardTitle>Devises &amp; taux de change</CardTitle>
      <p className="mt-1 text-xs text-muted">
        L&apos;Ariary (Ar) est la devise de référence. Mettez à jour les taux EUR/USD ici — ils s&apos;appliquent
        immédiatement partout dans l&apos;application.
      </p>
      {eur && usd && (
        <p className="mt-3 rounded-2xl bg-tile px-4 py-2.5 text-xs text-muted">
          <span className="font-medium text-foreground">Pour vérifier vos calculs</span> (ex : un retrait qui
          convertit d&apos;une devise à l&apos;autre) — 1 EUR = {formatMajor(convertAmount(1, "EUR", "USD", currencies), "USD")} · 1 USD ={" "}
          {formatMajor(convertAmount(1, "USD", "EUR", currencies), "EUR")}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {currencies.map((currency) => (
          <CurrencyRow key={currency.code} currency={currency} />
        ))}
      </div>
    </Card>
  );
}

function CurrencyRow({ currency }: { currency: Currency }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(currency.rateToBase));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/currencies/${currency.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rateToBase: Number(rate) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Erreur");
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-tile p-4">
      <div className="w-28">
        <p className="font-medium text-foreground">{currency.code}</p>
        <p className="text-xs text-muted">{currency.name}</p>
      </div>
      {currency.isBase ? (
        <p className="flex-1 text-sm text-muted">Devise de référence — taux fixe (1)</p>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-sm whitespace-nowrap text-muted">1 {currency.code} =</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              aria-label={`Taux ${currency.code} en Ariary`}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="w-32 bg-surface"
            />
            <span className="text-sm text-muted">Ar</span>
          </div>
          <Button size="sm" onClick={handleSave} loading={saving}>
            {saved ? "Enregistré ✓" : "Enregistrer"}
          </Button>
        </>
      )}
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
