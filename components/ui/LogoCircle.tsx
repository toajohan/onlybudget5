import { EntityIcon } from "@/components/icons/EntityIcon";
import { cn } from "@/lib/cn";

/** Round logo badge: white disc with the wallet/category icon (or its uploaded logo) inside, like a bank app's merchant logos. */
export function LogoCircle({
  icon,
  logoUrl,
  size = 44,
  tone = "light",
  className,
}: {
  icon?: string | null;
  logoUrl?: string | null;
  size?: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        tone === "light" ? "bg-white text-black" : "bg-surface-hover text-foreground",
        className
      )}
      style={{ width: size, height: size }}
    >
      <EntityIcon icon={icon} logoUrl={logoUrl} size={Math.round(size * (logoUrl ? 0.62 : 0.5))} className="object-contain" />
    </span>
  );
}
