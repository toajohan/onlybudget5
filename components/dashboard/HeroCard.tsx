import { cn } from "@/lib/cn";
import { formatMajorParts } from "@/lib/currency";
import { CurrencyChip, CurrencyToggle } from "./CurrencyToggle";

/** The big red-orange card: one headline amount, the currency switch, and the same amount in the other currencies. */
export function HeroCard({
  label,
  value,
  currencyCode,
  equivalents,
  className,
}: {
  label: string;
  value: number;
  currencyCode: string;
  equivalents: { code: string; text: string }[];
  className?: string;
}) {
  const { prefix, number, suffix } = formatMajorParts(value, currencyCode);
  const long = number.length > 10;

  return (
    <section aria-label={label} className={cn("relative pb-3.5", className)}>
      {/* second card peeking out under the first, for depth */}
      <div
        aria-hidden="true"
        className="absolute inset-x-4 bottom-0 h-11 rounded-b-[26px]"
        style={{ background: "linear-gradient(180deg, #7a4a24 0%, #3a2312 100%)" }}
      />
      <div className="hero-card relative flex h-full min-h-[224px] flex-col overflow-hidden rounded-[28px] p-5 text-white md:p-7 lg:min-h-[286px]">
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox="0 0 350 224"
          preserveAspectRatio="xMaxYMid slice"
          className="absolute inset-0"
          fill="rgba(255,255,255,0.05)"
        >
          <polygon points="350,0 350,120 250,60 290,0" />
          <polygon points="290,0 250,60 170,20 200,0" />
          <polygon points="350,120 300,190 230,110 250,60" />
          <polygon points="170,20 250,60 210,120 120,80" />
          <polygon points="0,150 90,110 130,190 0,224" />
        </svg>

        <div className="relative flex items-center justify-between gap-3">
          <span className="text-[15px]">{label}</span>
          <CurrencyToggle current={currencyCode} />
        </div>

        <div className="relative mt-auto flex items-baseline gap-1.5 pt-10 whitespace-nowrap">
          {prefix && <span className="text-2xl text-white/70">{prefix}</span>}
          <span
            className={cn(
              "leading-[1.1] font-medium tracking-[-0.03em]",
              long ? "text-[34px] md:text-[44px]" : "text-[46px] md:text-[56px]"
            )}
          >
            {number}
          </span>
          {suffix.trim() && <span className="text-2xl text-white/70">{suffix.trim()}</span>}
          <span className="ml-0.5 text-sm font-medium text-white/85">{currencyCode}</span>
        </div>

        {equivalents.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {equivalents.map((e) => (
              <CurrencyChip key={e.code} code={e.code} text={e.text} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
