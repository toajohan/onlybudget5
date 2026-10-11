"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
export type ToastInput = {
  title?: string;
  message: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};
type ToastItem = ToastInput & { id: number; tone: ToastTone };

export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for deletions: the confirm button is orange and the dialog gets a warning icon. */
  tone?: "danger" | "default";
};

type FeedbackApi = {
  toast: (input: ToastInput | string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("FeedbackProvider manquant");
  return ctx;
}

/** Small pop-up messages ("Gain modifié ✓"). */
export function useToast() {
  return useFeedback().toast;
}

/** Nice confirmation dialog instead of the browser's own `confirm()`: `if (!(await confirm({ ... }))) return;` */
export function useConfirm() {
  return useFeedback().confirm;
}

const MAX_TOASTS = 4;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const toast = useCallback((input: ToastInput | string) => {
    const t = typeof input === "string" ? { message: input } : input;
    const id = nextId.current++;
    setToasts((all) => [...all.slice(-(MAX_TOASTS - 1)), { ...t, id, tone: t.tone ?? "success" }]);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...options, resolve });
      }),
    []
  );

  function answer(ok: boolean) {
    dialog?.resolve(ok);
    setDialog(null);
  }

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col gap-2 md:top-4 md:right-4 md:left-auto md:w-[380px]"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
      <ConfirmDialog dialog={dialog} onAnswer={answer} />
    </FeedbackContext.Provider>
  );
}

const TONE_STYLES: Record<ToastTone, { icon: React.ReactNode; circle: string }> = {
  success: { icon: <Check className="h-[18px] w-[18px]" />, circle: "bg-success/15 text-success" },
  error: { icon: <AlertTriangle className="h-[18px] w-[18px]" />, circle: "bg-danger/15 text-danger" },
  info: { icon: <Bell className="h-[18px] w-[18px]" />, circle: "bg-white/10 text-white" },
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.durationMs ?? (toast.tone === "error" ? 8000 : 5500));
    return () => clearTimeout(timer);
    // The timer must start once per toast, whatever the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = TONE_STYLES[toast.tone];
  return (
    <div
      role="status"
      className="toast-in pointer-events-auto flex items-start gap-3 rounded-2xl bg-[#1c1c1c] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", style.circle)}>{style.icon}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && <p className="text-sm font-semibold text-foreground">{toast.title}</p>}
        <p className={cn("text-sm break-words", toast.title ? "text-muted" : "text-foreground")}>{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onClose();
            }}
            className="mt-1.5 cursor-pointer text-sm font-semibold text-ember hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConfirmDialog({
  dialog,
  onAnswer,
}: {
  dialog: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  onAnswer: (ok: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (dialog && !el.open) el.showModal();
    if (!dialog && el.open) el.close();
  }, [dialog]);

  const danger = dialog?.tone === "danger";

  return (
    <dialog
      ref={ref}
      // Escape key or backdrop click = cancel.
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      onClick={(e) => {
        if (e.target === ref.current) onAnswer(false);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[28px] bg-surface p-0 text-foreground backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {dialog && (
        <div className="flex flex-col items-center gap-4 px-6 pt-7 pb-6 text-center">
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full",
              danger ? "bg-danger/15 text-danger" : "bg-white/10 text-white"
            )}
          >
            <AlertTriangle className="h-6 w-6" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-[19px] font-semibold tracking-tight">{dialog.title}</h2>
            {dialog.message && <div className="text-sm text-muted">{dialog.message}</div>}
          </div>
          <div className="mt-1 flex w-full gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onAnswer(false)}>
              {dialog.cancelLabel ?? "Annuler"}
            </Button>
            <Button type="button" variant={danger ? "danger" : "primary"} className="flex-1" onClick={() => onAnswer(true)}>
              {dialog.confirmLabel ?? "Confirmer"}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
