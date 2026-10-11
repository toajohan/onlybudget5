"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/feedback/FeedbackProvider";
import { cn } from "@/lib/cn";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
};

/** Where system (push) notifications stand on THIS device. */
export type PushState = "loading" | "unconfigured" | "unsupported" | "denied" | "off" | "on";

type NotificationsApi = {
  items: NotificationItem[];
  unreadCount: number;
  openPanel: () => void;
  /** System (push) notifications on this device: one tap to switch them on from anywhere. */
  pushState: PushState;
  pushBusy: boolean;
  enablePush: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsApi | null>(null);

export function useNotifications(): NotificationsApi {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("NotificationsProvider manquant");
  return ctx;
}

const POLL_MS = 30_000;
const JSON_HEADERS = { "Content-Type": "application/json" };

/** The public VAPID key is sent as URL-safe base64; the browser wants raw bytes. */
function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function NotificationsProvider({ vapidPublicKey, children }: { vapidPublicKey: string; children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);

  // Latest values for the polling callback (it must not be re-created on every render).
  const routerRef = useRef(router);
  const toastRef = useRef(toast);
  useEffect(() => {
    routerRef.current = router;
    toastRef.current = toast;
  });

  const seen = useRef(new Set<string>());
  const initialized = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: NotificationItem[]; unreadCount: number };
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);

      const fresh = data.notifications.filter((n) => !n.read && !seen.current.has(n.id));
      data.notifications.forEach((n) => seen.current.add(n.id));
      if (!initialized.current) {
        // First load: what is already there is not "new".
        initialized.current = true;
        return;
      }
      if (fresh.length === 0) return;

      const open = () => setPanelOpen(true);
      if (fresh.length <= 3) {
        [...fresh].reverse().forEach((n) =>
          toastRef.current({ tone: "info", title: n.title, message: n.body, action: { label: "Voir", onClick: open }, durationMs: 9000 })
        );
      } else {
        toastRef.current({
          tone: "info",
          title: `${fresh.length} nouvelles notifications`,
          message: "Des modifications ont été faites.",
          action: { label: "Voir", onClick: open },
          durationMs: 9000,
        });
      }
      // Someone changed something: re-read the page so totals, profit and lists follow automatically.
      routerRef.current.refresh();
    } catch {
      // Offline or server hiccup: try again at the next tick.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "push") void refresh();
    };
    navigator.serviceWorker?.addEventListener("message", onWorkerMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
    };
  }, [refresh]);

  /* ------------------------------ system (push) notifications ------------------------------ */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let state: PushState;
      // The Android app shows its own native notifications (FCM), whatever the WebView supports for web push.
      if (isNativeApp()) state = "on";
      else if (!vapidPublicKey) state = "unconfigured";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) state = "unsupported";
      else if (Notification.permission === "denied") state = "denied";
      else {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = registration ? await registration.pushManager.getSubscription() : null;
        state = subscription && Notification.permission === "granted" ? "on" : "off";
        // Same device, maybe another account before: (re)attach the subscription to whoever is signed in now.
        if (state === "on" && subscription) {
          await fetch("/api/push/subscribe", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(subscription.toJSON()) }).catch(() => {});
        }
      }
      if (!cancelled) setPushState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(vapidPublicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(subscription.toJSON()) });
      if (!res.ok) throw new Error("subscribe");
      setPushState("on");
      toastRef.current({ message: "Notifications activées sur cet appareil." });
    } catch {
      toastRef.current({ tone: "error", message: "Impossible d'activer les notifications sur cet appareil." });
    } finally {
      setPushBusy(false);
    }
  }, [vapidPublicKey]);

  const disablePush = useCallback(async () => {
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {});
        await subscription.unsubscribe();
      }
      setPushState("off");
      toastRef.current({ tone: "info", message: "Notifications désactivées sur cet appareil." });
    } finally {
      setPushBusy(false);
    }
  }, []);

  const testPush = useCallback(async () => {
    setPushBusy(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
      if (!res.ok) toastRef.current({ tone: "error", message: body.error ?? "Le test a échoué." });
      else if ((body.sent ?? 0) === 0) toastRef.current({ tone: "error", message: "Aucun appareil n'a reçu le test. Désactivez puis réactivez les notifications." });
      else toastRef.current({ tone: "info", message: "Test envoyé : une notification va apparaître." });
    } finally {
      setPushBusy(false);
    }
  }, []);

  /* ------------------------------------- read / open ------------------------------------- */

  const markRead = useCallback(async (ids: string[] | "all") => {
    setItems((prev) => prev.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnreadCount((count) => (ids === "all" ? 0 : Math.max(0, count - ids.length)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(ids === "all" ? { all: true } : { ids }),
    }).catch(() => {});
  }, []);

  const api = useMemo<NotificationsApi>(
    () => ({ items, unreadCount, openPanel: () => setPanelOpen(true), pushState, pushBusy, enablePush }),
    [items, unreadCount, pushState, pushBusy, enablePush]
  );

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <Modal open={panelOpen} onClose={() => setPanelOpen(false)} title="Notifications">
        <div className="space-y-4">
          <PushSettings state={pushState} busy={pushBusy} onEnable={enablePush} onDisable={disablePush} onTest={testPush} />

          {items.length === 0 ? (
            <p className="rounded-2xl bg-tile px-4 py-6 text-center text-sm text-muted">Aucune notification pour l&apos;instant.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted">{unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}</p>
                {unreadCount > 0 && (
                  <button type="button" onClick={() => void markRead("all")} className="cursor-pointer text-[13px] font-semibold text-ember hover:underline">
                    Tout marquer comme lu
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void markRead([n.id]);
                        setPanelOpen(false);
                        if (n.url) router.push(n.url);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer gap-3 rounded-2xl p-3.5 text-left transition-colors hover:bg-surface-hover",
                        n.read ? "bg-tile/60" : "bg-tile ring-1 ring-ember/40"
                      )}
                    >
                      <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-ember")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{n.title}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {formatDistanceToNowStrict(new Date(n.createdAt), { locale: fr, addSuffix: true })}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-sm break-words text-muted">{n.body}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Modal>
    </NotificationsContext.Provider>
  );
}

/** The Android app's WebView appends this marker to its user agent. */
function isNativeApp(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("OnlyBudgetApp");
}

function PushSettings({
  state,
  busy,
  onEnable,
  onDisable,
  onTest,
}: {
  state: PushState;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onTest: () => void;
}) {
  const iosNeedsInstall =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-tile px-4 py-3 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Vérification des notifications de cet appareil…
      </div>
    );
  }

  if (state === "on") {
    return (
      <div className="space-y-3 rounded-2xl bg-success/10 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <BellRing className="h-4 w-4" /> Notifications activées sur cet appareil
        </p>
        <p className="text-sm text-muted">Vous serez prévenu à chaque vente ajoutée ou modification, même quand l&apos;application est fermée.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={onTest}>
            Envoyer un test
          </Button>
          {!isNativeApp() && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onDisable}>
              Désactiver
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (state === "off") {
    return (
      <div className="space-y-3 rounded-2xl bg-tile p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bell className="h-4 w-4" /> Recevoir les notifications sur cet appareil
        </p>
        <p className="text-sm text-muted">
          Une alerte s&apos;affiche quand un associé ou un chatteur ajoute une vente, ou quand quelque chose est modifié ou supprimé.
        </p>
        <Button size="sm" loading={busy} onClick={onEnable}>
          Activer les notifications
        </Button>
      </div>
    );
  }

  const messages: Record<"unconfigured" | "unsupported" | "denied", string> = {
    unconfigured: "Les notifications système ne sont pas encore configurées sur le serveur. Les notifications ci-dessous restent visibles dans l'application.",
    unsupported: iosNeedsInstall
      ? "Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil »), puis ouvrez-la depuis l'icône et activez les notifications ici."
      : "Ce navigateur ne permet pas les notifications système. Les notifications ci-dessous restent visibles dans l'application.",
    denied: "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône cadenas à côté de l'adresse → Notifications), puis revenez ici.",
  };
  return (
    <div className="flex gap-3 rounded-2xl bg-tile p-4">
      <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <p className="text-sm text-muted">{messages[state]}</p>
    </div>
  );
}
