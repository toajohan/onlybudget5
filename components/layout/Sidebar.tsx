"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { LogOut, Wallet } from "lucide-react";
import type { Role } from "@prisma/client";
import { NAV_ITEMS } from "./nav-items";
import { UserAvatar } from "./UserAvatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function Sidebar({ role, name, avatarUrl }: { role: Role; name: string; avatarUrl: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-7 border-r border-border bg-background/55 px-4 py-7 md:flex">
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="ember-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
            <Wallet className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate text-[17px] font-semibold tracking-tight text-foreground">OnlyBudget</span>
        </div>
        <NotificationBell className="h-10 w-10 rounded-full bg-tile text-foreground transition-colors hover:bg-surface-hover" />
      </div>

      <nav aria-label="Navigation principale" className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors",
                active ? "bg-white text-black" : "text-foreground hover:bg-white/10"
              )}
            >
              <Icon className={cn("h-5 w-5", active ? "text-black" : "text-muted")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-1 rounded-[22px] bg-tile p-2">
        <Link href="/profil" className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 hover:bg-white/5">
          <UserAvatar name={name} avatarUrl={avatarUrl} size={40} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            <span className="block text-xs text-muted">{role === "ASSOCIE" ? "Associé" : "Chatteur"}</span>
          </span>
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Déconnexion"
          title="Déconnexion"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </aside>
  );
}
