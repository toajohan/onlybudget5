"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Role } from "@prisma/client";
import { NAV_ITEMS } from "./nav-items";

/** Floating pill at the bottom of the phone screen: the active tab is a white pill with its label, the others are round icons. */
export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role)).slice(0, 4);

  return (
    <>
      <div aria-hidden="true" className="nav-fade pointer-events-none fixed inset-x-0 bottom-0 z-10 h-28 md:hidden" />
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-4 bottom-4 z-20 flex h-[68px] items-center justify-between rounded-full border border-white/10 bg-[#1c1c1c] p-[7px] md:hidden"
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={active ? undefined : item.label}
              className={cn(
                "flex h-[52px] items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
                active ? "bg-white px-4 text-black" : "w-[52px] text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
              {active && <span>{item.shortLabel ?? item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
