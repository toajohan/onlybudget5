"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import { MobileDrawer } from "./MobileDrawer";
import { UserAvatar } from "./UserAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { Role } from "@prisma/client";

const GLASS_BUTTON =
  "h-12 w-12 rounded-full border border-white/15 bg-white/15 text-white hover:bg-white/20 transition-colors";

/** Phone header (the desktop app has the user chip in the sidebar instead). */
export function Topbar({ name, role, avatarUrl }: { name: string; role: Role; avatarUrl: string | null }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="flex items-center gap-3 px-4 pt-5 pb-1 md:hidden">
        <Link href="/profil" className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar name={name} avatarUrl={avatarUrl} size={48} />
          <span className="min-w-0">
            <span className="block truncate text-base leading-snug font-semibold text-white">Bonjour, {name}</span>
            <span className="block text-[13px] leading-snug text-white/70">{role === "ASSOCIE" ? "Associé" : "Chatteur"}</span>
          </span>
        </Link>
        <NotificationBell className={GLASS_BUTTON} />
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu"
          className={`flex shrink-0 cursor-pointer items-center justify-center ${GLASS_BUTTON}`}
        >
          <Menu className="h-[22px] w-[22px]" />
        </button>
      </header>
      <MobileDrawer role={role} open={drawerOpen} onClose={() => setDrawerOpen(false)} onLogout={handleLogout} />
    </>
  );
}
