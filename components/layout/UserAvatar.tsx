import { cn } from "@/lib/cn";

/**
 * Round avatar: the member's profile photo when they have one (set in Équipe), otherwise their initial on the
 * red-orange gradient. It follows the photo automatically: no photo, no image, just the letter.
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = 48,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full bg-tile object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("ember-gradient flex shrink-0 items-center justify-center rounded-full font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
