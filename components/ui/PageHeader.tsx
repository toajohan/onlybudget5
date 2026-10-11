export function PageHeader({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-white/70">{subtitle}</p>}
    </div>
  );
}
