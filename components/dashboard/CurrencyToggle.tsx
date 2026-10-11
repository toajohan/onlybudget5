"use client";

import { ArrowLeftRight } from "lucide-react";
import { SegmentedControl, type SegmentItem } from "@/components/ui/SegmentedControl";
import { useUpdateParams } from "./use-update-params";

const ITEMS: SegmentItem<string>[] = [
  { value: "USD", label: "$", ariaLabel: "Dollar" },
  { value: "EUR", label: "€", ariaLabel: "Euro" },
  { value: "MGA", label: "Ar", ariaLabel: "Ariary" },
];

const NAMES: Record<string, string> = { USD: "dollar", EUR: "euro", MGA: "ariary" };

/** Switches the currency every aggregate figure of the dashboard is shown in (translucent, sits on top of the hero card). */
export function CurrencyToggle({ current }: { current: string }) {
  const { update } = useUpdateParams();

  return (
    <SegmentedControl
      label="Devise d'affichage"
      variant="glass"
      items={ITEMS}
      value={current}
      onChange={(code) => update({ cur: code === "USD" ? null : code })}
    />
  );
}

/** "≈ 1 086,01 €" pill on the hero card: one tap shows every figure in that currency. */
export function CurrencyChip({ code, text }: { code: string; text: string }) {
  const { update } = useUpdateParams();

  return (
    <button
      type="button"
      onClick={() => update({ cur: code === "USD" ? null : code })}
      title={`Afficher en ${NAMES[code] ?? code}`}
      className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-black/35 px-3 text-[13px] font-medium whitespace-nowrap text-white hover:bg-black/50"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      <span>{text}</span>
    </button>
  );
}
