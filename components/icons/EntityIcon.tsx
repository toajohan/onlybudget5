import { resolveIcon } from "./registry";
import { cn } from "@/lib/cn";

export function EntityIcon({
  icon,
  logoUrl,
  className,
  size = 18,
}: {
  icon?: string | null;
  logoUrl?: string | null;
  className?: string;
  size?: number;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={cn("rounded-md object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const Icon = resolveIcon(icon);
  // Icon is a stable reference looked up from the static ICON_REGISTRY, not created per render.
  // eslint-disable-next-line react-hooks/static-components
  return <Icon className={className} size={size} />;
}
