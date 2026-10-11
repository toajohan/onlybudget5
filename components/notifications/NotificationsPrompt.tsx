"use client";

import { useSyncExternalStore } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNotifications } from "./NotificationsProvider";

const STORAGE_KEY = "onlybudget:notif-prompt-dismissed";

// The "dismissed" choice lives in this browser only (localStorage), read without touching state in an effect.
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("onlybudget:prompt", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("onlybudget:prompt", callback);
  };
}
function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Banner at the top of the app until notifications are switched on for this device (or the banner is dismissed). */
export function NotificationsPrompt() {
  const { pushState, pushBusy, enablePush } = useNotifications();
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);

  if (pushState !== "off" || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private mode: the banner simply comes back next time.
    }
    window.dispatchEvent(new Event("onlybudget:prompt"));
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-3xl bg-tile p-3.5 pr-2 ring-1 ring-white/10">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
        <BellRing className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Activer les notifications</p>
        <p className="text-xs text-muted">Soyez prévenu dès qu&apos;une vente est ajoutée ou modifiée.</p>
      </div>
      <Button size="sm" loading={pushBusy} onClick={() => void enablePush()}>
        Activer
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Plus tard"
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
