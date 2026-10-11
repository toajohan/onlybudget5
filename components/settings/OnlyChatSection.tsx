"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlugZap } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/feedback/FeedbackProvider";

type TestResult = {
  creators: Array<{ id: string; name: string; platform: string }>;
  stats: Record<string, unknown>;
  raw: unknown;
};

/** Looks for a revenue total in get_stats' answer, whatever its exact shape. */
function findTotalRevenue(value: unknown, depth = 0): number | null {
  if (depth > 4 || value === null || typeof value !== "object") return null;
  for (const [key, v] of Object.entries(value)) {
    if (/^total_?revenue/i.test(key) && typeof v === "number") return v;
  }
  for (const v of Object.values(value)) {
    const found = findTotalRevenue(v, depth + 1);
    if (found !== null) return found;
  }
  return null;
}

export function OnlyChatSection({ url, hasKey }: { url: string | null; hasKey: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [urlValue, setUrlValue] = useState(url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/integrations/onlychat", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlValue.trim(), apiKey: apiKey.trim() || undefined }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setApiKey("");
    toast({ title: "OnlyChat enregistré", message: "Appuyez sur « Tester la connexion »." });
    router.refresh();
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/integrations/onlychat/test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as TestResult & { error?: string };
    setTesting(false);
    if (!res.ok) {
      setError(body.error ?? "Le test a échoué.");
      return;
    }
    setResult(body);
  }

  return (
    <Card>
      <CardTitle>OnlyChat</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Pour importer automatiquement les ventes OnlyChat. Collez l&apos;adresse du serveur MCP et la clé API fournies par OnlyChat
        (Paramètres → API). La clé est chiffrée et n&apos;est plus jamais affichée.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Label>Adresse (URL du MCP)</Label>
          <Input type="url" inputMode="url" placeholder="https://..." value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
        </div>
        <div>
          <Label>Clé API</Label>
          <Input
            type="password"
            autoComplete="off"
            placeholder={hasKey ? "•••••••• (enregistrée — laissez vide pour la garder)" : "Collez la clé ici"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {error && <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!urlValue.trim() || (!hasKey && !apiKey.trim())}>
            Enregistrer
          </Button>
          <Button size="sm" variant="secondary" onClick={handleTest} loading={testing} disabled={!url || !hasKey}>
            <PlugZap className="h-4 w-4" /> Tester la connexion
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Connecté — {result.creators.length} créateur{result.creators.length > 1 ? "s" : ""} trouvé
            {result.creators.length > 1 ? "s" : ""}
          </p>
          {result.creators.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-tile px-4 py-3">
              <span className="text-sm font-medium text-foreground">{c.name}</span>
              <Badge>{c.platform === "onlyfans" ? "OnlyFans" : "Telegram"}</Badge>
            </div>
          ))}
          {Object.entries(result.stats).map(([platform, stats]) => {
            const total = findTotalRevenue(stats);
            return (
              <p key={platform} className="rounded-2xl bg-tile px-4 py-3 text-sm text-foreground">
                Chiffre d&apos;affaires 7 derniers jours ({platform === "onlyfans" ? "OnlyFans" : "Telegram"}) :{" "}
                <span className="font-semibold">{total !== null ? `$${total.toFixed(2)}` : "voir détails"}</span>
              </p>
            );
          })}
          <details className="rounded-2xl bg-tile px-4 py-3 text-xs text-muted">
            <summary className="cursor-pointer text-foreground">Détails techniques (à envoyer à Claude)</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify({ stats: result.stats, creators: result.raw }, null, 2).slice(0, 6000)}
            </pre>
          </details>
        </div>
      )}
    </Card>
  );
}
