import { Wallet } from "lucide-react";

/** Shown the instant a page is tapped, while the next one loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="page-enter">
      <div className="flex flex-col items-center gap-4 pt-16 pb-10">
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="loader-ring absolute -inset-2 rounded-full" />
          <span className="ember-gradient loader-pulse flex h-16 w-16 items-center justify-center rounded-[22px] text-white shadow-[0_10px_30px_-8px_rgba(217,69,31,0.8)]">
            <Wallet className="h-7 w-7" />
          </span>
        </span>
        <p className="text-sm font-medium text-white/70">Chargement…</p>
      </div>
      <div className="space-y-3">
        <div className="skeleton h-40 rounded-[28px]" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton h-24 rounded-3xl" />
          <div className="skeleton h-24 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
