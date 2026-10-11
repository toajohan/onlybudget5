"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RouteForm, type RouteWithFee } from "@/components/forms/RouteForm";
import { EntityIcon } from "@/components/icons/EntityIcon";
import { useConfirm, useToast } from "@/components/feedback/FeedbackProvider";
import { cn } from "@/lib/cn";
import { formatMajor } from "@/lib/currency";
import { Plus, Archive, ArrowRight } from "lucide-react";
import type { Wallet } from "@prisma/client";

type ChainStep = { route: RouteWithFee; wallet: Wallet };
type Chain = { root: Wallet; steps: ChainStep[] };

function buildChains(wallets: Wallet[], routes: RouteWithFee[]): Chain[] {
  const byFrom = new Map<string, RouteWithFee>();
  const hasIncoming = new Set<string>();
  for (const r of routes) {
    if (!byFrom.has(r.fromWalletId)) byFrom.set(r.fromWalletId, r);
    hasIncoming.add(r.toWalletId);
  }

  const roots = wallets.filter((w) => byFrom.has(w.id) && !hasIncoming.has(w.id));

  return roots.map((root) => {
    const steps: ChainStep[] = [];
    let current = root.id;
    const visited = new Set([current]);
    while (byFrom.has(current)) {
      const route = byFrom.get(current)!;
      const toWallet = wallets.find((w) => w.id === route.toWalletId);
      if (!toWallet || visited.has(toWallet.id)) break;
      steps.push({ route, wallet: toWallet });
      visited.add(toWallet.id);
      current = toWallet.id;
    }
    return { root, steps };
  });
}

function feeLabel(route: RouteWithFee, fromWallet?: Wallet): string {
  if (route.feeType === "NONE") return "sans frais";
  if (route.feeType === "PERCENT") return `${route.feePercent}%`;
  return formatMajor(route.feeFixedMinor / 100, fromWallet?.currencyCode ?? "");
}

export function RoutesSection({ wallets, routes }: { wallets: Wallet[]; routes: RouteWithFee[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteWithFee | undefined>(undefined);
  const [lockedFrom, setLockedFrom] = useState<string | undefined>(undefined);

  function openCreate() {
    setEditingRoute(undefined);
    setLockedFrom(undefined);
    setModalOpen(true);
  }
  function openAddStep(fromWalletId: string) {
    setEditingRoute(undefined);
    setLockedFrom(fromWalletId);
    setModalOpen(true);
  }
  function openEdit(route: RouteWithFee) {
    setEditingRoute(route);
    setLockedFrom(undefined);
    setModalOpen(true);
  }

  async function archiveRoute(step: ChainStep) {
    const from = wallets.find((w) => w.id === step.route.fromWalletId)?.name ?? "";
    const ok = await confirm({
      title: "Supprimer cette étape ?",
      message: `${from} → ${step.wallet.name} ne sera plus proposé pour les retraits. Les retraits déjà faits sont conservés.`,
      confirmLabel: "Supprimer",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/wallet-routes/${step.route.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ tone: "error", message: "Impossible de supprimer cette étape." });
      return;
    }
    toast({ title: "Étape supprimée", message: `${from} → ${step.wallet.name}` });
    router.refresh();
  }

  const chains = buildChains(wallets, routes);
  const chainedWalletIds = new Set(chains.flatMap((c) => [c.root.id, ...c.steps.map((s) => s.wallet.id)]));
  const unusedWallets = wallets.filter((w) => !chainedWalletIds.has(w.id));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>Chemins de retrait</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouveau chemin
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Chaque ligne montre le chemin complet d&apos;une source jusqu&apos;à sa destination finale, avec les frais entre
        chaque étape.
      </p>

      {chains.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Aucun chemin configuré pour l&apos;instant.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {chains.map((chain) => (
            <div key={chain.root.id} className="rounded-3xl bg-tile p-4">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                <WalletChip wallet={chain.root} root />
                {chain.steps.map((step) => (
                  <div key={step.route.id} className="group flex items-center gap-1.5">
                    <FeeArrow
                      label={feeLabel(step.route, wallets.find((w) => w.id === step.route.fromWalletId))}
                      onClick={() => openEdit(step.route)}
                    />
                    <WalletChip wallet={step.wallet} />
                    <button
                      onClick={() => archiveRoute(step)}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted opacity-60 transition-opacity hover:bg-white/10 hover:text-danger hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      title="Supprimer cette étape"
                      aria-label="Supprimer cette étape"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => openAddStep(chain.steps.at(-1)?.wallet.id ?? chain.root.id)}
                  className="flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-white/25 px-3 text-xs text-muted hover:border-white hover:text-white"
                >
                  <Plus className="h-3 w-3" /> Étape suivante
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unusedWallets.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Pas encore dans un chemin : {unusedWallets.map((w) => w.name).join(", ")}.
        </p>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoute ? "Modifier l'étape" : lockedFrom ? "Ajouter une étape" : "Nouveau chemin de retrait"}
      >
        <RouteForm
          key={editingRoute?.id ?? lockedFrom ?? "new"}
          wallets={wallets}
          route={editingRoute}
          lockedFromWalletId={lockedFrom}
          onSuccess={() => setModalOpen(false)}
        />
      </Modal>
    </Card>
  );
}

function WalletChip({ wallet, root }: { wallet: Wallet; root?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
        root ? "bg-white text-black" : "bg-surface-hover text-foreground"
      )}
    >
      <EntityIcon icon={wallet.icon} logoUrl={wallet.logoUrl} size={14} />
      {wallet.name}
    </span>
  );
}

function FeeArrow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex cursor-pointer flex-col items-center px-0.5 text-muted hover:text-white" title="Modifier le frais">
      <span className="text-[10px] leading-tight whitespace-nowrap">{label}</span>
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}
