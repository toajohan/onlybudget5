"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptics";

const PRESSABLE = 'button, a[href], [role="button"], summary, select, input[type="checkbox"], input[type="radio"]';

/**
 * What makes the site feel like an app: a light haptic under the finger on every control, and a progress bar at the
 * top of the screen from the tap on a link until the next page is there (a slow connection otherwise shows nothing).
 */
export function AppFeel() {
  const pathname = usePathname();
  // The page a navigation started from: the bar shows until the pathname moves on.
  const [leaving, setLeaving] = useState<string | null>(null);
  // Arrived: forget where we left from, or coming back to that page later would show the bar again.
  if (leaving !== null && leaving !== pathname) setLeaving(null);
  const loading = leaving === pathname;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      const target = (e.target as Element | null)?.closest?.(PRESSABLE);
      if (target && !(target as HTMLButtonElement).disabled) haptic("tap");
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setLeaving(window.location.pathname);
      clearTimeout(timer);
      timer = setTimeout(() => setLeaving(null), 15000);
    }

    document.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  if (!loading) return null;
  return (
    <div role="progressbar" aria-label="Chargement de la page" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div className="nav-progress h-full rounded-r-full" />
    </div>
  );
}
