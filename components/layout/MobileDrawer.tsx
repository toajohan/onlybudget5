"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Wallet, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Role } from "@prisma/client";
import { NAV_ITEMS } from "./nav-items";

export function MobileDrawer({
  role,
  open,
  onClose,
  onLogout,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 rounded-r-[28px] bg-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="ember-gradient flex h-10 w-10 items-center justify-center rounded-[13px] text-white">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-[19px] font-semibold tracking-tight text-foreground">OnlyBudget</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-tile text-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
        <button
          onClick={onLogout}
          className="flex h-12 cursor-pointer items-center gap-3 rounded-full bg-tile px-4 text-[15px] font-medium text-foreground hover:bg-surface-hover"
        >
          <LogOut className="h-5 w-5 text-muted" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
