"use client";

import { useMemo, useState } from "react";
import { Amount } from "@/components/ui/Amount";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoCircle } from "@/components/ui/LogoCircle";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TxRow } from "@/components/ui/TxRow";
import { dateInputValue, formatDate, formatDayLabel, formatTime, todayInputValue, yesterdayInputValue } from "@/lib/date";
import { equivalentLabel, formatMajor, toMajorUnits, type CurrencyLike } from "@/lib/currency";
import { formatNumberFr } from "@/lib/audit";
import { Archive, ArrowLeftRight, History as HistoryIcon, KeyRound, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import type { HistoryEntry } from "@/lib/history";

type Filter = "ALL" | HistoryEntry["type"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tout" },
  { value: "GAIN", label: "Gains" },
  { value: "EXPENSE", label: "Dépenses" },
  { value: "TRANSFER", label: "Retraits" },
  { value: "AUDIT", label: "Modifications" },
];

function AuditIcon({ action, className }: { action: string; className?: string }) {
  if (action === "data.reset") return <RotateCcw className={className} />;
  if (action.endsWith(".deleted")) return <Trash2 className={className} />;
  if (action.endsWith(".created")) return <Plus className={className} />;
  if (action.endsWith(".archived")) return <Archive className={className} />;
  if (action.startsWith("user.")) return <Users className={className} />;
  if (action.startsWith("profile.")) return <KeyRound className={className} />;
  return <Pencil className={className} />;
}

/** " · pour le 18 sept. 2026" when the gain/expense was booked for another day than the one it was entered. */
function bookedFor(entry: { createdAt: Date; date: Date }): string | null {
  return dateInputValue(entry.createdAt) === entry.date.toISOString().slice(0, 10) ? null : `pour le ${formatDate(entry.date)}`;
}

function dayTitle(key: string): string {
  if (key === todayInputValue()) return `Aujourd'hui · ${formatDayLabel(key)}`;
  if (key === yesterdayInputValue()) return `Hier · ${formatDayLabel(key)}`;
  return formatDayLabel(key);
}

export function HistoryTable({
  entries,
  currencies,
  filterable,
}: {
  entries: HistoryEntry[];
  currencies: CurrencyLike[];
  /** Filter chips (associates only: a chatter's feed is just their gains). */
  filterable: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const groups = useMemo(() => {
    const visible = filter === "ALL" ? entries : entries.filter((e) => e.type === filter);
    const byDay = new Map<string, HistoryEntry[]>();
    for (const entry of visible) {
      const key = dateInputValue(entry.createdAt);
      byDay.set(key, [...(byDay.get(key) ?? []), entry]);
    }
    return [...byDay.entries()];
  }, [entries, filter]);

  if (entries.length === 0) {
    return <EmptyState icon={HistoryIcon} title="Aucune activité pour l'instant" />;
  }

  return (
    <div className="space-y-5">
      {filterable && (
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <SegmentedControl label="Type d'activité" items={FILTERS} value={filter} onChange={setFilter} />
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted">Rien dans cette catégorie pour l&apos;instant.</p>
      ) : (
        groups.map(([day, dayEntries]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-[13px] font-medium text-muted">{dayTitle(day)}</h2>
            {dayEntries.map((entry) => (
              <HistoryRow key={`${entry.type}-${entry.id}`} entry={entry} currencies={currencies} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function HistoryRow({ entry, currencies }: { entry: HistoryEntry; currencies: CurrencyLike[] }) {
  const time = formatTime(entry.createdAt);

  if (entry.type === "GAIN") {
    const value = toMajorUnits(entry.amountMinor);
    const commission =
      entry.grossAmountMinor !== null && (entry.commissionPercent ?? 0) > 0
        ? `${formatMajor(toMajorUnits(entry.grossAmountMinor), entry.currencyCode)} − ${formatNumberFr(entry.commissionPercent!)} % commission`
        : null;
    return (
      <TxRow
        wrapTitle
        leading={<LogoCircle icon={entry.walletIcon} logoUrl={entry.walletLogoUrl} />}
        title={`Gain · ${entry.walletName}`}
        subtitle={[entry.chatterName, time, commission, entry.createdByName !== entry.chatterName ? `par ${entry.createdByName}` : null, bookedFor(entry), entry.note].filter(Boolean).join(" · ")}
        amount={<Amount value={value} currencyCode={entry.currencyCode} sign="positive" />}
        eq={equivalentLabel(value, entry.currencyCode, currencies)}
      />
    );
  }

  if (entry.type === "EXPENSE") {
    const value = toMajorUnits(entry.amountMinor);
    return (
      <TxRow
        wrapTitle
        leading={<LogoCircle icon={entry.categoryIcon} logoUrl={entry.categoryLogoUrl} />}
        title={entry.categoryName}
        subtitle={[`depuis ${entry.walletName}`, time, `par ${entry.createdByName}`, bookedFor(entry), entry.note].filter(Boolean).join(" · ")}
        amount={<Amount value={value} currencyCode={entry.currencyCode} sign="negative" />}
        eq={equivalentLabel(value, entry.currencyCode, currencies)}
      />
    );
  }

  if (entry.type === "TRANSFER") {
    return (
      <TxRow
        wrapTitle
        leading={
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black">
            <ArrowLeftRight className="h-[22px] w-[22px]" />
          </span>
        }
        title="Retrait"
        subtitle={[`${entry.fromWalletName} → ${entry.toWalletName}`, time, `par ${entry.createdByName}`, entry.note].filter(Boolean).join(" · ")}
        amount={<Amount value={toMajorUnits(entry.amountSentMinor)} currencyCode={entry.fromCurrencyCode} sign="negative" />}
        eq={
          [
            // Cross-currency retraits convert (Wysper en EUR → Banque en USD) : on montre le montant reçu pour que
            // le calcul reste vérifiable, pas seulement "les frais".
            entry.fromCurrencyCode !== entry.toCurrencyCode
              ? `→ ${formatMajor(toMajorUnits(entry.amountReceivedMinor), entry.toCurrencyCode)} reçus`
              : null,
            entry.feeAmountMinor > 0 ? `frais : ${formatMajor(toMajorUnits(entry.feeAmountMinor), entry.fromCurrencyCode)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
    );
  }

  return (
    <TxRow
      wrapTitle
      leading={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-hover text-foreground">
          <AuditIcon action={entry.action} className="h-5 w-5" />
        </span>
      }
      title={
        <>
          <span className="font-semibold">{entry.createdByName}</span> {entry.phrase}
        </>
      }
      subtitle={[entry.details, time].filter(Boolean).join(" · ")}
    />
  );
}
