"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { INPUT_CLASSES } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  currentMonthInputValue,
  lastMonthInputValue,
  todayInputValue,
  validDayOr,
  validMonthOr,
  yesterdayInputValue,
} from "@/lib/date";
import { useUpdateParams } from "./use-update-params";

const DATE_INPUT = cn(INPUT_CLASSES, "h-11 w-auto rounded-full px-4 py-0 text-sm");

export function DateFilterBar() {
  const { params, update } = useUpdateParams();
  const mode = params.get("mode") === "month" ? "month" : "day";

  const today = todayInputValue();
  const yesterday = yesterdayInputValue();
  const thisMonth = currentMonthInputValue();
  const lastMonth = lastMonthInputValue();
  const day = validDayOr(params.get("date") ?? undefined, today);
  const month = validMonthOr(params.get("month") ?? undefined, thisMonth);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Période"
        items={[
          { value: "day", label: "Jour" },
          { value: "month", label: "Mois" },
        ]}
        value={mode}
        onChange={(next) => update({ mode: next === "month" ? "month" : null })}
      />

      {mode === "day" ? (
        <>
          <SegmentedControl
            label="Jour affiché"
            items={[
              { value: today, label: "Aujourd'hui" },
              { value: yesterday, label: "Hier" },
            ]}
            value={day}
            onChange={(next) => update({ date: next })}
          />
          <input
            type="date"
            aria-label="Choisir une date"
            value={day}
            max={today}
            onChange={(e) => e.target.value && update({ date: e.target.value })}
            className={DATE_INPUT}
          />
        </>
      ) : (
        <>
          <SegmentedControl
            label="Mois affiché"
            items={[
              { value: thisMonth, label: "Ce mois" },
              { value: lastMonth, label: "Mois dernier" },
            ]}
            value={month}
            onChange={(next) => update({ month: next })}
          />
          <input
            type="month"
            aria-label="Choisir un mois"
            value={month}
            max={thisMonth}
            onChange={(e) => e.target.value && update({ month: e.target.value })}
            className={DATE_INPUT}
          />
        </>
      )}
    </div>
  );
}
